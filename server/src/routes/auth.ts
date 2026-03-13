import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { generateTokens, verifyRefreshToken, authMiddleware, AuthRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { username, email, password, referralCode } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({ error: 'Все поля обязательны' });
    return;
  }

  if (username.length < 3 || username.length > 20) {
    res.status(400).json({ error: 'Имя пользователя: 3-20 символов' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Пароль минимум 6 символов' });
    return;
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });

  if (existing) {
    res.status(409).json({ error: 'Пользователь с таким именем или email уже существует' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Handle referral
  let referredBy: string | undefined;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (referrer) referredBy = referrer.id;
  }

  const user = await prisma.user.create({
    data: { username, email, passwordHash, referredBy },
  });

  // Referral bonus: $50 to referrer
  if (referredBy) {
    const referrer = await prisma.user.findUnique({ where: { id: referredBy } });
    if (referrer) {
      await prisma.user.update({ where: { id: referredBy }, data: { balance: { increment: 50 } } });
      await prisma.transaction.create({
        data: {
          userId: referredBy,
          type: 'REFERRAL_BONUS',
          amount: 50,
          balBefore: Number(referrer.balance),
          balAfter: Number(referrer.balance) + 50,
          refId: user.id,
        },
      });
    }
  }

  const tokens = generateTokens({ userId: user.id, username: user.username });

  // Save refresh token
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  res.status(201).json({
    user: { id: user.id, username: user.username, email: user.email, balance: Number(user.balance) },
    ...tokens,
  });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { login, password } = req.body;

  if (!login || !password) {
    res.status(400).json({ error: 'Введите логин и пароль' });
    return;
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: login }, { email: login }] },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Неверный логин или пароль' });
    return;
  }

  const tokens = generateTokens({ userId: user.id, username: user.username });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  res.json({
    user: { id: user.id, username: user.username, email: user.email, balance: Number(user.balance) },
    ...tokens,
  });
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ error: 'Token required' });
    return;
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  // Check if token exists in DB
  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt < new Date()) {
    res.status(401).json({ error: 'Token expired' });
    return;
  }

  // Rotate: delete old, create new
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  const tokens = generateTokens({ userId: user.id, username: user.username });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  res.json(tokens);
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    balance: Number(user.balance),
    level: user.level,
    xp: user.xp,
    role: user.role,
    createdAt: user.createdAt,
  });
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  res.json({ ok: true });
});

export default router;
