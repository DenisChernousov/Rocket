import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { gameEngine } from '../services/GameEngine';
import { AchievementService } from '../services/AchievementService';
import prisma from '../utils/prisma';

const router = Router();

// GET /api/game/state
router.get('/state', (_req, res) => {
  res.json(gameEngine.getPublicState());
});

// GET /api/game/history
router.get('/history', async (_req, res) => {
  const history = await gameEngine.getHistory(50);
  res.json(history);
});

// GET /api/game/:id
router.get('/:id', async (req, res: Response): Promise<void> => {
  const game = await prisma.game.findUnique({
    where: { id: req.params.id },
    include: {
      bets: {
        include: { user: { select: { username: true } } },
      },
    },
  });

  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  // Only reveal seed after crash
  res.json({
    id: game.id,
    hash: game.hash,
    seed: game.status === 'CRASHED' ? game.seed : null,
    crashPoint: game.status === 'CRASHED' ? Number(game.crashPoint) : null,
    status: game.status,
    startedAt: game.startedAt,
    crashedAt: game.crashedAt,
    bets: game.bets.map(b => ({
      id: b.id,
      username: b.user.username,
      amount: Number(b.amount),
      cashOutAt: b.cashOutAt ? Number(b.cashOutAt) : null,
      profit: b.profit ? Number(b.profit) : null,
      status: b.status,
    })),
  });
});

// GET /api/game/my/bets — user's bet history
router.get('/my/bets', authMiddleware, async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

  const [bets, total] = await Promise.all([
    prisma.bet.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: {
        game: { select: { crashPoint: true, hash: true } },
      },
    }),
    prisma.bet.count({ where: { userId: req.user!.userId } }),
  ]);

  res.json({
    bets: bets.map(b => ({
      id: b.id,
      gameId: b.gameId,
      amount: Number(b.amount),
      cashOutAt: b.cashOutAt ? Number(b.cashOutAt) : null,
      profit: b.profit ? Number(b.profit) : null,
      status: b.status,
      crashPoint: Number(b.game.crashPoint),
      gameHash: b.game.hash,
      createdAt: b.createdAt,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// GET /api/game/my/profile — player stats & profile
router.get('/my/profile', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const achievements = await AchievementService.getUserAchievements(user.id);

  // Win rate
  const [totalBets, wonBets] = await Promise.all([
    prisma.bet.count({ where: { userId: user.id } }),
    prisma.bet.count({ where: { userId: user.id, status: 'CASHED_OUT' } }),
  ]);

  // Best win
  const bestWin = await prisma.bet.findFirst({
    where: { userId: user.id, status: 'CASHED_OUT' },
    orderBy: { profit: 'desc' },
  });

  // Best multiplier
  const bestMultiplier = await prisma.bet.findFirst({
    where: { userId: user.id, status: 'CASHED_OUT', cashOutAt: { not: null } },
    orderBy: { cashOutAt: 'desc' },
  });

  // XP for next level
  const xpForNext = (user.level + 1) * 100;

  res.json({
    username: user.username,
    level: user.level,
    xp: user.xp,
    xpForNext,
    role: user.role,
    balance: Number(user.balance),
    totalWagered: user.totalWagered,
    totalProfit: user.totalProfit,
    gamesPlayed: user.gamesPlayed,
    winRate: totalBets > 0 ? Math.round((wonBets / totalBets) * 100) : 0,
    bestWin: bestWin ? Number(bestWin.profit) : 0,
    bestMultiplier: bestMultiplier?.cashOutAt || 0,
    referralCode: user.referralCode,
    dailyStreak: user.dailyStreak,
    achievements,
    createdAt: user.createdAt,
  });
});

export default router;
