import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

const router = Router();

const DAILY_REWARDS = [10, 15, 25, 40, 60, 100, 200]; // 7-day streak

// POST /api/bonus/daily
router.post('/daily', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Check if already claimed today
  if (user.lastDailyAt && user.lastDailyAt >= todayStart) {
    const nextAvail = new Date(todayStart);
    nextAvail.setDate(nextAvail.getDate() + 1);
    res.status(400).json({ error: 'Уже получено сегодня', nextAvailable: nextAvail.toISOString() });
    return;
  }

  // Calculate streak
  let streak = user.dailyStreak;
  if (user.lastDailyAt) {
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    if (user.lastDailyAt >= yesterdayStart) {
      streak = Math.min(streak + 1, DAILY_REWARDS.length);
    } else {
      streak = 1; // Reset streak
    }
  } else {
    streak = 1;
  }

  const rewardDay = Math.min(streak, DAILY_REWARDS.length);
  const amount = DAILY_REWARDS[rewardDay - 1];

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: user.id },
      data: {
        balance: { increment: amount },
        dailyStreak: streak,
        lastDailyAt: now,
      },
    });

    await tx.dailyBonus.create({
      data: { userId: user.id, amount, day: rewardDay },
    });

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: 'DAILY_BONUS',
        amount,
        balBefore: Number(user.balance),
        balAfter: Number(u.balance),
      },
    });

    return u;
  });

  res.json({
    amount,
    streak,
    day: rewardDay,
    balance: Number(updated.balance),
    rewards: DAILY_REWARDS,
  });
});

// GET /api/bonus/daily/status
router.get('/daily/status', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const claimed = user.lastDailyAt ? user.lastDailyAt >= todayStart : false;

  const nextDay = Math.min(user.dailyStreak + (claimed ? 0 : 1), DAILY_REWARDS.length);

  res.json({
    claimed,
    streak: user.dailyStreak,
    nextReward: DAILY_REWARDS[nextDay - 1] || DAILY_REWARDS[DAILY_REWARDS.length - 1],
    rewards: DAILY_REWARDS,
    nextAvailable: claimed ? new Date(todayStart.getTime() + 86400000).toISOString() : null,
  });
});

// POST /api/bonus/promo
router.post('/promo', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: 'Введите промокод' }); return; }

  const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
  if (!promo || !promo.active) { res.status(404).json({ error: 'Промокод не найден' }); return; }
  if (promo.expiresAt && promo.expiresAt < new Date()) { res.status(400).json({ error: 'Промокод истёк' }); return; }
  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) { res.status(400).json({ error: 'Промокод исчерпан' }); return; }

  // Check if already used
  const existing = await prisma.promoUsage.findUnique({
    where: { userId_promoId: { userId: req.user!.userId, promoId: promo.id } },
  });
  if (existing) { res.status(400).json({ error: 'Промокод уже использован' }); return; }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: user.id },
      data: { balance: { increment: promo.bonus } },
    });

    await tx.promoCode.update({
      where: { id: promo.id },
      data: { usedCount: { increment: 1 } },
    });

    await tx.promoUsage.create({
      data: { userId: user.id, promoId: promo.id, amount: promo.bonus },
    });

    await tx.transaction.create({
      data: {
        userId: user.id,
        type: 'PROMO_BONUS',
        amount: promo.bonus,
        balBefore: Number(user.balance),
        balAfter: Number(u.balance),
        refId: promo.code,
      },
    });

    return u;
  });

  res.json({ amount: promo.bonus, balance: Number(updated.balance), code: promo.code });
});

// GET /api/bonus/referral
router.get('/referral', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const referrals = await prisma.user.count({ where: { referredBy: user.id } });
  const referralEarnings = await prisma.transaction.aggregate({
    where: { userId: user.id, type: 'REFERRAL_BONUS' },
    _sum: { amount: true },
  });

  res.json({
    code: user.referralCode,
    referrals,
    earnings: referralEarnings._sum.amount || 0,
  });
});

export default router;
