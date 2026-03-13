import { WebSocket } from 'ws';

// Game states
export type GamePhase = 'waiting' | 'running' | 'crashed';

export interface GameState {
  id: string;
  phase: GamePhase;
  crashPoint: number;
  multiplier: number;
  startTime: number | null;
  elapsed: number;
  hash: string;
  players: PlayerBet[];
}

export interface PlayerBet {
  id: string;
  betId: string;
  userId: string;
  username: string;
  amount: number;
  cashOutAt: number | null;
  profit: number | null;
}

// WebSocket messages
export type WSClientMsg =
  | { type: 'place_bet'; amount: number; autoCashOut?: number }
  | { type: 'cash_out' }
  | { type: 'chat_message'; message: string }
  | { type: 'ping' };

export type WSServerMsg =
  | { type: 'game_state'; data: PublicGameState }
  | { type: 'game_tick'; multiplier: number; elapsed: number }
  | { type: 'game_start'; gameId: string; hash: string }
  | { type: 'game_crash'; crashPoint: number; gameId: string }
  | { type: 'game_waiting'; countdown: number; nextGameId: string }
  | { type: 'bet_placed'; bet: PublicBet }
  | { type: 'bet_cashout'; bet: PublicBet }
  | { type: 'player_bet'; bet: PublicBet }
  | { type: 'player_cashout'; bet: PublicBet }
  | { type: 'balance_update'; balance: number }
  | { type: 'error'; message: string }
  | { type: 'history'; games: GameHistoryItem[] }
  | { type: 'chat'; msg: ChatMsg }
  | { type: 'chat_history'; messages: ChatMsg[] }
  | { type: 'achievement_unlocked'; achievement: AchievementData }
  | { type: 'rain_start'; amount: number; id: string }
  | { type: 'rain_claimed'; userId: string; amount: number }
  | { type: 'pong' };

export interface PublicGameState {
  id: string;
  phase: GamePhase;
  multiplier: number;
  elapsed: number;
  hash: string;
  players: PublicBet[];
  countdown?: number;
}

export interface PublicBet {
  betId: string;
  userId: string;
  username: string;
  amount: number;
  cashOutAt: number | null;
  profit: number | null;
}

export interface GameHistoryItem {
  id: string;
  crashPoint: number;
  hash: string;
  createdAt: string;
  playerCount: number;
}

export interface ChatMsg {
  id: string;
  userId: string;
  username: string;
  message: string;
  level: number;
  role: string;
  createdAt: string;
}

export interface AchievementData {
  code: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
}

export interface AuthSocket extends WebSocket {
  userId?: string;
  username?: string;
  role?: string;
  level?: number;
  isAlive?: boolean;
}

export interface JwtPayload {
  userId: string;
  username: string;
}
