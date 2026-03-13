export type GamePhase = 'waiting' | 'running' | 'crashed';

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

export interface User {
  id: string;
  username: string;
  email: string;
  balance: number;
  level: number;
  xp: number;
  role: string;
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
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  level: number;
  totalProfit: number;
  gamesWon: number;
}

export interface PlayerProfile {
  username: string;
  level: number;
  xp: number;
  xpForNext: number;
  role: string;
  balance: number;
  totalWagered: number;
  totalProfit: number;
  gamesPlayed: number;
  winRate: number;
  bestWin: number;
  bestMultiplier: number;
  referralCode: string;
  dailyStreak: number;
  achievements: AchievementData[];
  createdAt: string;
}

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
  | { type: 'pong' };
