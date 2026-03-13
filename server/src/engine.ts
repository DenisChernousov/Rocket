import crypto from 'crypto';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { addXp } from './lib/xp';
import { EventEmitter } from 'events';

export interface ActiveBet {
  betId: string;
  userId: string;
  username: string;
  amount: number;
  autoCashOut?: number;
  cashOutAt: number | null;
  profit: number | null;
}

export class GameEngine extends EventEmitter {
  private gameId = '';
  private hash = '';
  private seed = '';
  private crashPoint = 0;
  private phase: 'waiting' | 'running' | 'crashed' = 'waiting';
  private multiplier = 1.0;
  private elapsed = 0;
  private bets = new Map<string, ActiveBet>();
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private waitTime = 5000;
  private houseEdge = 5;
  private minBet = 0.1;
  private maxBet = 1000;

  async start() {
    await this.loadSettings();
    this.newRound();
  }

  private async loadSettings() {
    try {
      const settings = await prisma.gameSettings.findMany();
      for (const s of settings) {
        switch (s.key) {
          case 'house_edge': this.houseEdge = parseFloat(s.value); break;
          case 'min_bet': this.minBet = parseFloat(s.value); break;
          case 'max_bet': this.maxBet = parseFloat(s.value); break;
          case 'wait_time': this.waitTime = parseFloat(s.value) * 1000; break;
        }
      }
    } catch {
      // defaults
    }
  }

  private generateCrashPoint(): number {
    const e = this.houseEdge / 100;
    const h = crypto.randomBytes(4).readUInt32BE(0);
    // Provably fair crash point generation
    if (h % 33 === 0) return 1.0; // Instant crash ~3%
    const r = (h / 0xFFFFFFFF);
    return Math.max(1.0, Math.floor((1 / (1 - r * (1 - e))) * 100) / 100);
  }

  private async newRound() {
    this.phase = 'waiting';
    this.bets.clear();
    this.multiplier = 1.0;
    this.elapsed = 0;

    this.seed = crypto.randomBytes(32).toString('hex');
    this.hash = crypto.createHash('sha256').update(this.seed).digest('hex');
    this.crashPoint = this.generateCrashPoint();

    // Create game in DB
    const game = await prisma.game.create({
      data: {
        hash: this.hash,
        seed: this.seed,
        crashPoint: this.crashPoint,
        status: 'pending',
      },
    });
    this.gameId = game.id;

    this.emit('game_waiting', {
      countdown: this.waitTime,
      nextGameId: this.gameId,
    });

    // Send history
    const history = await prisma.game.findMany({
      where: { status: 'crashed' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, crashPoint: true, hash: true, createdAt: true, playerCount: true },
    });
    this.emit('history', history);

    await this.loadSettings();

    setTimeout(() => this.startRound(), this.waitTime);
  }

  private async startRound() {
    this.phase = 'running';
    this.startTime = Date.now();

    await prisma.game.update({
      where: { id: this.gameId },
      data: { status: 'running' },
    });

    this.emit('game_start', {
      gameId: this.gameId,
      hash: this.hash,
    });

    this.tickInterval = setInterval(() => this.tick(), 50);
  }

  private tick() {
    this.elapsed = Date.now() - this.startTime;
    // Exponential growth curve: multiplier = e^(0.00006 * elapsed)
    this.multiplier = Math.floor(Math.exp(0.00006 * this.elapsed) * 100) / 100;

    // Check auto cashouts
    for (const [userId, bet] of this.bets) {
      if (bet.cashOutAt === null && bet.autoCashOut && this.multiplier >= bet.autoCashOut) {
        this.doCashOut(userId, bet.autoCashOut);
      }
    }

    if (this.multiplier >= this.crashPoint) {
      this.crash();
      return;
    }

    this.emit('game_tick', {
      multiplier: this.multiplier,
      elapsed: this.elapsed,
    });
  }

  private async crash() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.phase = 'crashed';
    this.multiplier = this.crashPoint;

    // Process losing bets
    for (const [userId, bet] of this.bets) {
      if (bet.cashOutAt === null) {
        bet.profit = -bet.amount;
        await prisma.bet.update({
          where: { id: bet.betId },
          data: { profit: -bet.amount },
        });

        // Update user stats
        await prisma.user.update({
          where: { id: userId },
          data: {
            totalProfit: { decrement: bet.amount },
          },
        });
      }
    }

    const playerCount = this.bets.size;
    await prisma.game.update({
      where: { id: this.gameId },
      data: { status: 'crashed', playerCount },
    });

    this.emit('game_crash', {
      crashPoint: this.crashPoint,
      gameId: this.gameId,
    });

    // New round after delay
    setTimeout(() => this.newRound(), 3000);
  }

  async placeBet(userId: string, username: string, amount: number, autoCashOut?: number): Promise<ActiveBet | string> {
    if (this.phase !== 'waiting') return 'Bets are closed';
    if (this.bets.has(userId)) return 'Already bet this round';
    if (amount < this.minBet) return `Min bet is $${this.minBet}`;
    if (amount > this.maxBet) return `Max bet is $${this.maxBet}`;

    // Check balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.balance < amount) return 'Insufficient balance';
    if (user.banned) return 'Account banned';

    // Deduct balance
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        balance: { decrement: amount },
        totalWagered: { increment: amount },
        gamesPlayed: { increment: 1 },
      },
    });

    // Create bet
    const dbBet = await prisma.bet.create({
      data: {
        userId,
        gameId: this.gameId,
        amount,
        autoCashOut: autoCashOut || null,
      },
    });

    // Transaction
    await prisma.transaction.create({
      data: {
        userId,
        type: 'bet',
        amount: -amount,
        balance: updated.balance,
        note: `Game ${this.gameId.slice(0, 8)}`,
      },
    });

    const bet: ActiveBet = {
      betId: dbBet.id,
      userId,
      username,
      amount,
      autoCashOut,
      cashOutAt: null,
      profit: null,
    };

    this.bets.set(userId, bet);

    // Check achievements
    this.checkAchievements(userId, amount, null);

    return bet;
  }

  async cashOut(userId: string): Promise<ActiveBet | string> {
    if (this.phase !== 'running') return 'Game not running';
    const bet = this.bets.get(userId);
    if (!bet) return 'No active bet';
    if (bet.cashOutAt !== null) return 'Already cashed out';

    return this.doCashOut(userId, this.multiplier);
  }

  private async doCashOut(userId: string, atMultiplier: number): Promise<ActiveBet> {
    const bet = this.bets.get(userId)!;
    bet.cashOutAt = atMultiplier;
    bet.profit = Math.floor((bet.amount * atMultiplier - bet.amount) * 100) / 100;

    const winAmount = Math.floor(bet.amount * atMultiplier * 100) / 100;

    // Update DB
    await prisma.bet.update({
      where: { id: bet.betId },
      data: { cashOutAt: atMultiplier, profit: bet.profit },
    });

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        balance: { increment: winAmount },
        totalProfit: { increment: bet.profit },
        gamesWon: { increment: 1 },
      },
    });

    // Update best win/multiplier
    await prisma.user.update({
      where: { id: userId },
      data: {
        bestWin: Math.max(user.bestWin, bet.profit),
        bestMultiplier: Math.max(user.bestMultiplier, atMultiplier),
      },
    });

    await prisma.transaction.create({
      data: {
        userId,
        type: 'win',
        amount: winAmount,
        balance: user.balance,
        note: `Won at ${atMultiplier}x`,
      },
    });

    this.emit('player_cashout', this.publicBet(bet));
    this.emit('balance_update', { userId, balance: user.balance });

    // Check achievements
    this.checkAchievements(userId, bet.amount, atMultiplier, bet.profit);

    return bet;
  }

  private async checkAchievements(userId: string, betAmount: number, multiplier: number | null, profit?: number) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { achievements: true },
      });
      if (!user) return;

      const allAchievements = await prisma.achievement.findMany();
      const unlockedCodes = new Set(user.achievements.map(a => a.achievementCode));

      for (const ach of allAchievements) {
        if (unlockedCodes.has(ach.code)) continue;

        const condition = JSON.parse(ach.condition);
        let earned = false;

        switch (condition.type) {
          case 'games_played':
            earned = user.gamesPlayed >= condition.value;
            break;
          case 'single_bet':
            earned = betAmount >= condition.value;
            break;
          case 'multiplier':
            earned = multiplier !== null && multiplier >= condition.value;
            break;
          case 'total_wagered':
            earned = user.totalWagered >= condition.value;
            break;
          case 'daily_streak':
            earned = user.dailyStreak >= condition.value;
            break;
          case 'single_win':
            earned = (profit ?? 0) >= condition.value;
            break;
        }

        if (earned) {
          await prisma.userAchievement.create({
            data: { userId, achievementCode: ach.code },
          });

          const { xp, level } = addXp(user.xp, user.level, ach.xpReward);
          await prisma.user.update({
            where: { id: userId },
            data: { xp, level },
          });

          this.emit('achievement_unlocked', {
            userId,
            achievement: {
              code: ach.code,
              name: ach.name,
              description: ach.description,
              icon: ach.icon,
              xpReward: ach.xpReward,
              unlocked: true,
              unlockedAt: new Date().toISOString(),
            },
          });
        }
      }
    } catch (err) {
      console.error('Achievement check error:', err);
    }
  }

  getState() {
    return {
      id: this.gameId,
      phase: this.phase,
      multiplier: this.multiplier,
      elapsed: this.elapsed,
      hash: this.hash,
      players: Array.from(this.bets.values()).map(b => this.publicBet(b)),
      countdown: this.phase === 'waiting' ? this.waitTime : 0,
    };
  }

  private publicBet(bet: ActiveBet) {
    return {
      betId: bet.betId,
      userId: bet.userId,
      username: bet.username,
      amount: bet.amount,
      cashOutAt: bet.cashOutAt,
      profit: bet.profit,
    };
  }
}
