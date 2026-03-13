import { WebSocketServer } from 'ws';
import { IncomingMessage, Server } from 'http';
import { verifyAccessToken } from '../middleware/auth';
import { gameEngine } from '../services/GameEngine';
import { AchievementService, UserStats } from '../services/AchievementService';
import { AuthSocket, WSClientMsg, WSServerMsg, ChatMsg } from '../types';
import prisma from '../utils/prisma';

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Set<AuthSocket>();

  function broadcast(msg: WSServerMsg) {
    const data = JSON.stringify(msg);
    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(data);
      }
    }
  }

  function sendTo(client: AuthSocket, msg: WSServerMsg) {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(msg));
    }
  }

  function findClient(userId: string): AuthSocket | undefined {
    for (const c of clients) {
      if (c.userId === userId && c.readyState === c.OPEN) return c;
    }
    return undefined;
  }

  // Check achievements after game events
  async function checkAchievements(userId: string) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return;

      // Get max multiplier from cashed out bets
      const maxBet = await prisma.bet.findFirst({
        where: { userId, status: 'CASHED_OUT', cashOutAt: { not: null } },
        orderBy: { cashOutAt: 'desc' },
      });

      // Get win streak (last N bets)
      const recentBets = await prisma.bet.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      let winStreak = 0;
      for (const b of recentBets) {
        if (b.status === 'CASHED_OUT') winStreak++;
        else break;
      }

      const stats: UserStats = {
        gamesPlayed: user.gamesPlayed,
        totalWagered: user.totalWagered,
        totalProfit: user.totalProfit,
        maxMultiplier: maxBet?.cashOutAt || 0,
        winStreak,
        dailyStreak: user.dailyStreak,
      };

      const newAchievements = await AchievementService.checkAndGrant(userId, stats);
      const client = findClient(userId);
      if (client) {
        for (const a of newAchievements) {
          sendTo(client, { type: 'achievement_unlocked', achievement: a });
        }
      }
    } catch (err) {
      console.error('[Achievements] Error:', err);
    }
  }

  // === Game engine events ===
  gameEngine.on('waiting', (data) => {
    broadcast({ type: 'game_waiting', countdown: data.countdown, nextGameId: data.nextGameId });
  });

  gameEngine.on('start', (data) => {
    broadcast({ type: 'game_start', gameId: data.gameId, hash: data.hash });
  });

  gameEngine.on('tick', (data) => {
    broadcast({ type: 'game_tick', multiplier: data.multiplier, elapsed: data.elapsed });
  });

  gameEngine.on('crash', async (data) => {
    broadcast({ type: 'game_crash', crashPoint: data.crashPoint, gameId: data.gameId });
    const history = await gameEngine.getHistory();
    broadcast({ type: 'history', games: history });
  });

  gameEngine.on('player_bet', (bet) => {
    broadcast({ type: 'player_bet', bet });
  });

  gameEngine.on('player_cashout', (bet) => {
    broadcast({ type: 'player_cashout', bet });
  });

  // === Connection handling ===
  wss.on('connection', async (ws: AuthSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (user && !user.isBanned) {
          ws.userId = payload.userId;
          ws.username = payload.username;
          ws.role = user.role;
          ws.level = user.level;
        }
      }
    }

    ws.isAlive = true;
    clients.add(ws);

    // Send current game state
    sendTo(ws, { type: 'game_state', data: gameEngine.getPublicState() });

    // Send history
    const history = await gameEngine.getHistory();
    sendTo(ws, { type: 'history', games: history });

    // Send balance + chat history if authenticated
    if (ws.userId) {
      const user = await prisma.user.findUnique({ where: { id: ws.userId } });
      if (user) {
        sendTo(ws, { type: 'balance_update', balance: Number(user.balance) });
      }
    }

    // Send recent chat
    const recentChat = await prisma.chatMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { username: true, level: true, role: true } } },
    });
    sendTo(ws, {
      type: 'chat_history',
      messages: recentChat.reverse().map(m => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        message: m.message,
        level: m.user.level,
        role: m.user.role,
        createdAt: m.createdAt.toISOString(),
      })),
    });

    // Handle messages
    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WSClientMsg;

        switch (msg.type) {
          case 'ping':
            ws.isAlive = true;
            sendTo(ws, { type: 'pong' });
            break;

          case 'place_bet': {
            if (!ws.userId || !ws.username) {
              sendTo(ws, { type: 'error', message: 'Необходимо авторизоваться' });
              return;
            }

            // Check if banned
            const betUser = await prisma.user.findUnique({ where: { id: ws.userId } });
            if (betUser?.isBanned) {
              sendTo(ws, { type: 'error', message: 'Аккаунт заблокирован' });
              return;
            }

            const result = await gameEngine.placeBet(
              ws.userId, ws.username, msg.amount, msg.autoCashOut
            );

            if (typeof result === 'string') {
              sendTo(ws, { type: 'error', message: result });
            } else {
              sendTo(ws, { type: 'bet_placed', bet: result });
              const user = await prisma.user.findUnique({ where: { id: ws.userId } });
              if (user) {
                sendTo(ws, { type: 'balance_update', balance: Number(user.balance) });
              }

              // Update user stats
              await prisma.user.update({
                where: { id: ws.userId },
                data: {
                  gamesPlayed: { increment: 1 },
                  totalWagered: { increment: msg.amount },
                },
              });

              checkAchievements(ws.userId);
            }
            break;
          }

          case 'cash_out': {
            if (!ws.userId) {
              sendTo(ws, { type: 'error', message: 'Необходимо авторизоваться' });
              return;
            }

            const result = await gameEngine.cashOut(ws.userId);

            if (typeof result === 'string') {
              sendTo(ws, { type: 'error', message: result });
            } else {
              sendTo(ws, { type: 'bet_cashout', bet: result });
              const user = await prisma.user.findUnique({ where: { id: ws.userId } });
              if (user) {
                sendTo(ws, { type: 'balance_update', balance: Number(user.balance) });
              }

              // Update profit stats
              if (result.profit && result.profit > 0) {
                await prisma.user.update({
                  where: { id: ws.userId },
                  data: { totalProfit: { increment: result.profit } },
                });
              }

              checkAchievements(ws.userId);
            }
            break;
          }

          case 'chat_message': {
            if (!ws.userId || !ws.username) {
              sendTo(ws, { type: 'error', message: 'Необходимо авторизоваться для чата' });
              return;
            }

            const chatUser = await prisma.user.findUnique({ where: { id: ws.userId } });
            if (chatUser?.isMuted) {
              sendTo(ws, { type: 'error', message: 'Вы заблокированы в чате' });
              return;
            }

            const text = msg.message?.trim().slice(0, 200);
            if (!text) return;

            const chatMsg = await prisma.chatMessage.create({
              data: { userId: ws.userId, message: text },
            });

            const chatData: ChatMsg = {
              id: chatMsg.id,
              userId: ws.userId,
              username: ws.username,
              message: text,
              level: ws.level || 1,
              role: ws.role || 'USER',
              createdAt: chatMsg.createdAt.toISOString(),
            };

            broadcast({ type: 'chat', msg: chatData });
            break;
          }
        }
      } catch (err) {
        sendTo(ws, { type: 'error', message: 'Invalid message' });
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });

  // Heartbeat
  const heartbeat = setInterval(() => {
    for (const ws of clients) {
      if (!ws.isAlive) {
        clients.delete(ws);
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  console.log(`[WS] WebSocket server attached to HTTP server`);
  return wss;
}
