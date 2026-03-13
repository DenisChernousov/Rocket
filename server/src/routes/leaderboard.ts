import { Router, Response, Request } from 'express';
import prisma from '../utils/prisma';

const router = Router();

// GET /api/leaderboard?period=today|week|month|all
router.get('/', async (req: Request, res: Response) => {
  const period = (req.query.period as string) || 'today';
  let dateFilter: Date | undefined;

  const now = new Date();
  switch (period) {
    case 'today':
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      dateFilter = new Date(now);
      dateFilter.setDate(dateFilter.getDate() - 7);
      break;
    case 'month':
      dateFilter = new Date(now);
      dateFilter.setMonth(dateFilter.getMonth() - 1);
      break;
    default:
      dateFilter = undefined;
  }

  // Top winners by profit
  const where = dateFilter ? { createdAt: { gte: dateFilter }, status: 'CASHED_OUT' } : { status: 'CASHED_OUT' };

  const topWinners = await prisma.bet.groupBy({
    by: ['userId'],
    where,
    _sum: { profit: true },
    _count: true,
    orderBy: { _sum: { profit: 'desc' } },
    take: 20,
  });

  // Get user details
  const userIds = topWinners.map(w => w.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, level: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const leaderboard = topWinners
    .map(w => {
      const user = userMap.get(w.userId);
      return user ? {
        userId: w.userId,
        username: user.username,
        level: user.level,
        totalProfit: Math.round((w._sum.profit || 0) * 100) / 100,
        gamesWon: w._count,
      } : null;
    })
    .filter(Boolean);

  // Top multiplier catches
  const topMultipliers = await prisma.bet.findMany({
    where: {
      status: 'CASHED_OUT',
      cashOutAt: { not: null },
      ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
    },
    orderBy: { cashOutAt: 'desc' },
    take: 10,
    include: { user: { select: { username: true, level: true } } },
  });

  const bigWins = topMultipliers.map(b => ({
    username: b.user.username,
    level: b.user.level,
    multiplier: b.cashOutAt!,
    amount: b.amount,
    profit: b.profit || 0,
  }));

  // Biggest single wins
  const biggestWins = await prisma.bet.findMany({
    where: {
      status: 'CASHED_OUT',
      profit: { gt: 0 },
      ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
    },
    orderBy: { profit: 'desc' },
    take: 10,
    include: { user: { select: { username: true, level: true } } },
  });

  const topPayouts = biggestWins.map(b => ({
    username: b.user.username,
    level: b.user.level,
    amount: b.amount,
    cashOutAt: b.cashOutAt,
    profit: b.profit || 0,
  }));

  res.json({ leaderboard, bigWins, topPayouts, period });
});

export default router;
