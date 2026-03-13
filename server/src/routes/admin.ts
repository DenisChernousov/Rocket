import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

const router = Router();

// Admin guard middleware
async function adminGuard(req: AuthRequest, res: Response, next: Function) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user || user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  next();
}

// GET /api/admin/dashboard
router.get('/dashboard', authMiddleware, adminGuard, async (_req: AuthRequest, res: Response) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    totalUsers, onlineCount, totalGames,
    todayVolume, todayProfit,
    weekVolume, weekProfit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { updatedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } } }),
    prisma.game.count({ where: { status: 'CRASHED' } }),
    prisma.bet.aggregate({ where: { createdAt: { gte: todayStart } }, _sum: { amount: true } }),
    prisma.bet.aggregate({ where: { createdAt: { gte: todayStart }, status: 'LOST' }, _sum: { amount: true } }),
    prisma.bet.aggregate({ where: { createdAt: { gte: weekStart } }, _sum: { amount: true } }),
    prisma.bet.aggregate({ where: { createdAt: { gte: weekStart }, status: 'LOST' }, _sum: { amount: true } }),
  ]);

  res.json({
    totalUsers,
    onlineCount,
    totalGames,
    todayVolume: todayVolume._sum.amount || 0,
    todayProfit: todayProfit._sum.amount || 0,
    weekVolume: weekVolume._sum.amount || 0,
    weekProfit: weekProfit._sum.amount || 0,
  });
});

// GET /api/admin/users
router.get('/users', authMiddleware, adminGuard, async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1')) || 1);
  const search = (String(req.query.search || '')) || '';
  const limit = 20;

  const where = search ? {
    OR: [
      { username: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ]
  } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      select: {
        id: true, username: true, email: true, balance: true, role: true,
        xp: true, level: true, isBanned: true, isMuted: true,
        totalWagered: true, totalProfit: true, gamesPlayed: true,
        createdAt: true,
        _count: { select: { bets: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // Map field names for client compatibility
  const mappedUsers = users.map(u => ({
    ...u,
    banned: u.isBanned,
    muted: u.isMuted,
  }));
  res.json({ users: mappedUsers, total, page, totalPages: Math.ceil(total / limit) });
});

// POST /api/admin/users/:id/ban
router.post('/users/:id/ban', authMiddleware, adminGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: { isBanned: true },
  });
  res.json({ ok: true, username: user.username });
});

// POST /api/admin/users/:id/unban
router.post('/users/:id/unban', authMiddleware, adminGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: { isBanned: false },
  });
  res.json({ ok: true, username: user.username });
});

// POST /api/admin/users/:id/mute
router.post('/users/:id/mute', authMiddleware, adminGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.user.update({ where: { id: req.params.id as string }, data: { isMuted: true } });
  res.json({ ok: true });
});

// POST /api/admin/users/:id/unmute
router.post('/users/:id/unmute', authMiddleware, adminGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.user.update({ where: { id: req.params.id as string }, data: { isMuted: false } });
  res.json({ ok: true });
});

// POST /api/admin/users/:id/balance
router.post('/users/:id/balance', authMiddleware, adminGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const amount = parseFloat(req.body.amount);
  if (isNaN(amount)) { res.status(400).json({ error: 'Invalid amount' }); return; }

  const user = await prisma.user.findUnique({ where: { id: req.params.id as string } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const updated = await prisma.user.update({
    where: { id: req.params.id as string },
    data: { balance: { increment: amount } },
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: amount >= 0 ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      amount: Math.abs(amount),
      balBefore: Number(user.balance),
      balAfter: Number(updated.balance),
    },
  });

  res.json({ balance: Number(updated.balance) });
});

// POST /api/admin/users/:id/role
router.post('/users/:id/role', authMiddleware, adminGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const { role } = req.body;
  if (!['USER', 'ADMIN'].includes(role)) { res.status(400).json({ error: 'Invalid role' }); return; }
  await prisma.user.update({ where: { id: req.params.id as string }, data: { role } });
  res.json({ ok: true });
});

// === PROMO CODES ===

// GET /api/admin/promos
router.get('/promos', authMiddleware, adminGuard, async (_req: AuthRequest, res: Response) => {
  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { usages: true } } },
  });
  res.json({ promos: promos.map(p => ({
    id: p.id,
    code: p.code,
    amount: p.bonus,
    maxUses: p.maxUses,
    usedCount: p.usedCount,
    expiresAt: p.expiresAt,
    createdAt: p.createdAt,
  })) });
});

// POST /api/admin/promos
router.post('/promos', authMiddleware, adminGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const { code, amount, bonus, maxUses, expiresAt } = req.body;
  const bonusAmount = parseFloat(amount || bonus);
  if (!code || !bonusAmount) { res.status(400).json({ error: 'Code and amount required' }); return; }

  const promo = await prisma.promoCode.create({
    data: {
      code: code.toUpperCase(),
      bonus: bonusAmount,
      maxUses: parseInt(maxUses) || 0,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });
  res.json(promo);
});

// DELETE /api/admin/promos/:id
router.delete('/promos/:id', authMiddleware, adminGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.promoCode.update({ where: { id: req.params.id as string }, data: { active: false } });
  res.json({ ok: true });
});

// === SETTINGS ===

// GET /api/admin/settings
router.get('/settings', authMiddleware, adminGuard, async (_req: AuthRequest, res: Response) => {
  const settings = await prisma.siteSetting.findMany();
  const map: Record<string, string> = {};
  settings.forEach(s => map[s.key] = s.value);
  res.json(map);
});

// POST /api/admin/settings
router.post('/settings', authMiddleware, adminGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const entries = Object.entries(req.body as Record<string, string>);
  for (const [key, value] of entries) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }
  res.json({ ok: true });
});

// GET /api/admin/finance
router.get('/finance', authMiddleware, adminGuard, async (req: AuthRequest, res: Response) => {
  const days = parseInt(String(req.query.days || '14')) || 14;
  const results = [];

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [volume, lost] = await Promise.all([
      prisma.bet.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      prisma.bet.aggregate({ where: { createdAt: { gte: start, lt: end }, status: 'LOST' }, _sum: { amount: true } }),
    ]);

    results.push({
      date: start.toISOString().split('T')[0],
      volume: Math.round((volume._sum.amount || 0) * 100) / 100,
      profit: Math.round((lost._sum.amount || 0) * 100) / 100,
    });
  }

  res.json({ days: results });
});

export default router;
