import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';


const router = Router();

// GET /api/wallet/balance
router.get('/balance', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ balance: Number(user.balance) });
});

// POST /api/wallet/deposit (demo — just adds money)
router.post('/deposit', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const amount = parseFloat(req.body.amount);
  if (!amount || amount < 1 || amount > 100000) {
    res.status(400).json({ error: 'Сумма от 1 до 100,000' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { balance: { increment: amount } },
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      type: 'DEPOSIT',
      amount: Number(amount.toFixed(2)),
      balBefore: user.balance,
      balAfter: updated.balance,
    },
  });

  res.json({ balance: Number(updated.balance) });
});

// GET /api/wallet/transactions
router.get('/transactions', authMiddleware, async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;

  const [txs, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.transaction.count({ where: { userId: req.user!.userId } }),
  ]);

  res.json({
    transactions: txs.map(t => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      balBefore: Number(t.balBefore),
      balAfter: Number(t.balAfter),
      createdAt: t.createdAt,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

export default router;
