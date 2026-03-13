import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';

import authRoutes from './routes/auth';
import gameRoutes from './routes/game';
import walletRoutes from './routes/wallet';
import adminRoutes from './routes/admin';
import leaderboardRoutes from './routes/leaderboard';
import bonusRoutes from './routes/bonus';
import { setupWebSocket } from './ws/handler';
import { gameEngine } from './services/GameEngine';
import { AchievementService } from './services/AchievementService';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/bonus', bonusRoutes);

// Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// HTTP + WS server
const server = createServer(app);
setupWebSocket(server);

server.listen(PORT, async () => {
  console.log(`[Server] HTTP + WS running on port ${PORT}`);

  // Seed achievements
  try {
    await AchievementService.seedAchievements();
  } catch (err) {
    console.error('[Achievements] Seed error:', err);
  }

  // Start game engine
  try {
    await gameEngine.init();
  } catch (err) {
    console.error('[Game] Failed to initialize:', err);
  }
});
