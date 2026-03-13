import { EventEmitter } from 'events';
import prisma from '../utils/prisma';
import { generateGame, multiplierAtTime, timeForMultiplier } from '../utils/crypto';
import { GamePhase, GameState, PlayerBet, PublicBet, PublicGameState, GameHistoryItem } from '../types';

const WAIT_TIME = 5000;       // 5s countdown between rounds
const TICK_INTERVAL = 50;     // 50ms tick = 20fps

export class GameEngine extends EventEmitter {
  private state: GameState;
  private tickTimer: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private crashTimeMs: number = 0;

  constructor() {
    super();
    this.state = {
      id: '',
      phase: 'waiting',
      crashPoint: 0,
      multiplier: 1.00,
      startTime: null,
      elapsed: 0,
      hash: '',
      players: [],
    };
  }

  async init() {
    console.log('[Game] Engine initializing...');
    await this.startNewRound();
  }

  getPublicState(): PublicGameState {
    return {
      id: this.state.id,
      phase: this.state.phase,
      multiplier: this.state.multiplier,
      elapsed: this.state.elapsed,
      hash: this.state.phase === 'crashed' ? this.state.hash : '',
      players: this.state.players.map(p => this.toPublicBet(p)),
      countdown: this.state.phase === 'waiting' ? Math.max(0, WAIT_TIME - this.state.elapsed) : undefined,
    };
  }

  private toPublicBet(p: PlayerBet): PublicBet {
    return {
      betId: p.betId,
      userId: p.userId,
      username: p.username,
      amount: p.amount,
      cashOutAt: p.cashOutAt,
      profit: p.profit,
    };
  }

  async getHistory(limit = 20): Promise<GameHistoryItem[]> {
    const games = await prisma.game.findMany({
      where: { status: 'CRASHED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { _count: { select: { bets: true } } },
    });

    return games.map(g => ({
      id: g.id,
      crashPoint: Number(g.crashPoint),
      hash: g.hash,
      createdAt: g.createdAt.toISOString(),
      playerCount: g._count.bets,
    }));
  }

  // === ROUND LIFECYCLE ===

  private async startNewRound() {
    // Generate provably fair game
    const { seed, hash, crashPoint } = generateGame();

    // Save to DB
    const game = await prisma.game.create({
      data: { seed, hash, crashPoint: Number(crashPoint.toFixed(2)), status: 'PENDING' },
    });

    this.state = {
      id: game.id,
      phase: 'waiting',
      crashPoint,
      multiplier: 1.00,
      startTime: null,
      elapsed: 0,
      hash: hash,
      players: [],
    };

    this.crashTimeMs = timeForMultiplier(crashPoint);

    console.log(`[Game] New round ${game.id} | crash @ ${crashPoint}x (${Math.round(this.crashTimeMs)}ms)`);

    this.emit('waiting', { countdown: WAIT_TIME, nextGameId: game.id });

    // Countdown
    const startedWaiting = Date.now();
    this.countdownTimer = setInterval(() => {
      const elapsed = Date.now() - startedWaiting;
      this.state.elapsed = elapsed;
      if (elapsed >= WAIT_TIME) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.startGame();
      }
    }, 100);
  }

  private async startGame() {
    this.state.phase = 'running';
    this.state.startTime = Date.now();
    this.state.elapsed = 0;
    this.state.multiplier = 1.00;

    await prisma.game.update({
      where: { id: this.state.id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    this.emit('start', { gameId: this.state.id, hash: this.state.hash });

    // Game tick loop
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL);
  }

  private tick() {
    if (!this.state.startTime) return;

    const elapsed = Date.now() - this.state.startTime;
    const multiplier = multiplierAtTime(elapsed);

    this.state.elapsed = elapsed;
    this.state.multiplier = multiplier;

    // Check if crashed
    if (elapsed >= this.crashTimeMs) {
      this.crash();
      return;
    }

    this.emit('tick', { multiplier, elapsed });
  }

  private async crash() {
    if (this.tickTimer) clearInterval(this.tickTimer);

    this.state.phase = 'crashed';
    this.state.multiplier = this.state.crashPoint;

    // Mark all remaining bets as LOST
    const lostBets = this.state.players.filter(p => p.cashOutAt === null);
    if (lostBets.length > 0) {
      await prisma.bet.updateMany({
        where: {
          gameId: this.state.id,
          status: 'PENDING',
        },
        data: { status: 'LOST', profit: 0 },
      });
    }

    // Update lost players' state
    lostBets.forEach(p => {
      p.profit = -p.amount;
    });

    await prisma.game.update({
      where: { id: this.state.id },
      data: { status: 'CRASHED', crashedAt: new Date() },
    });

    console.log(`[Game] Crashed @ ${this.state.crashPoint}x | ${this.state.players.length} players`);

    this.emit('crash', {
      crashPoint: this.state.crashPoint,
      gameId: this.state.id,
    });

    // Start next round after delay
    setTimeout(() => this.startNewRound(), 2000);
  }

  // === PLAYER ACTIONS ===

  async placeBet(userId: string, username: string, amount: number, autoCashOut?: number): Promise<PublicBet | string> {
    if (this.state.phase !== 'waiting') {
      return 'Ставки принимаются только перед раундом';
    }

    if (amount < 1 || amount > 10000) {
      return 'Ставка от 1 до 10,000';
    }

    // Check if already bet this round
    if (this.state.players.find(p => p.userId === userId)) {
      return 'Вы уже сделали ставку в этом раунде';
    }

    // Check balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || Number(user.balance) < amount) {
      return 'Недостаточно средств';
    }

    // Deduct balance + create bet in transaction
    const [updatedUser, bet] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      }),
      prisma.bet.create({
        data: {
          userId,
          gameId: this.state.id,
          amount: Number(amount.toFixed(2)),
          status: 'PENDING',
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: 'BET_PLACE',
          amount: Number(amount.toFixed(2)),
          balBefore: user.balance,
          balAfter: Number(Number(user.balance) - amount),
          refId: this.state.id,
        },
      }),
    ]);

    const playerBet: PlayerBet = {
      id: bet.id,
      betId: bet.id,
      userId,
      username,
      amount,
      cashOutAt: autoCashOut || null,
      profit: null,
    };

    this.state.players.push(playerBet);

    const publicBet = this.toPublicBet(playerBet);
    this.emit('player_bet', publicBet);

    return publicBet;
  }

  async cashOut(userId: string): Promise<PublicBet | string> {
    if (this.state.phase !== 'running') {
      return 'Нельзя забрать ставку сейчас';
    }

    const player = this.state.players.find(p => p.userId === userId && p.cashOutAt === null);
    if (!player) {
      return 'Ставка не найдена';
    }

    const cashOutMultiplier = this.state.multiplier;
    const profit = Math.floor(player.amount * cashOutMultiplier * 100) / 100;

    player.cashOutAt = cashOutMultiplier;
    player.profit = profit - player.amount;

    // Update DB
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return 'Пользователь не найден';

    await prisma.$transaction([
      prisma.bet.update({
        where: { id: player.betId },
        data: {
          cashOutAt: Number(cashOutMultiplier.toFixed(2)),
          profit: Number((profit - player.amount).toFixed(2)),
          status: 'CASHED_OUT',
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { balance: { increment: profit } },
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: 'BET_WIN',
          amount: Number(profit.toFixed(2)),
          balBefore: user.balance,
          balAfter: Number(Number(user.balance) + profit),
          refId: player.betId,
        },
      }),
    ]);

    const publicBet = this.toPublicBet(player);
    this.emit('player_cashout', publicBet);

    return publicBet;
  }

  // Auto cash-out check (called each tick)
  async checkAutoCashOuts() {
    if (this.state.phase !== 'running') return;

    for (const player of this.state.players) {
      if (player.cashOutAt !== null && player.profit === null) {
        // Auto cash-out target set, profit not yet taken
        if (this.state.multiplier >= player.cashOutAt) {
          await this.cashOut(player.userId);
        }
      }
    }
  }

  get phase() { return this.state.phase; }
  get currentMultiplier() { return this.state.multiplier; }
  get gameId() { return this.state.id; }
}

// Singleton
export const gameEngine = new GameEngine();

// Hook auto cash-out into tick
gameEngine.on('tick', () => {
  gameEngine.checkAutoCashOuts();
});
