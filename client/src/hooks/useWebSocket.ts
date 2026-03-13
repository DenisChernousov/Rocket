import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSServerMsg, PublicBet, GameHistoryItem, GamePhase, ChatMsg, AchievementData } from '@/types';

interface GameData {
  phase: GamePhase;
  multiplier: number;
  elapsed: number;
  gameId: string;
  hash: string;
  players: PublicBet[];
  countdown: number;
  crashPoint: number | null;
  history: GameHistoryItem[];
  balance: number;
  myBet: PublicBet | null;
  error: string | null;
  chatMessages: ChatMsg[];
  newAchievement: AchievementData | null;
}

export function useWebSocket(userId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [data, setData] = useState<GameData>({
    phase: 'waiting',
    multiplier: 1.00,
    elapsed: 0,
    gameId: '',
    hash: '',
    players: [],
    countdown: 5000,
    crashPoint: null,
    history: [],
    balance: 0,
    myBet: null,
    error: null,
    chatMessages: [],
    newAchievement: null,
  });

  const connect = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws${token ? `?token=${token}` : ''}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 2000);
    };

    ws.onmessage = (e) => {
      const msg: WSServerMsg = JSON.parse(e.data);

      setData(prev => {
        switch (msg.type) {
          case 'game_state':
            return {
              ...prev,
              phase: msg.data.phase,
              multiplier: msg.data.multiplier,
              elapsed: msg.data.elapsed,
              gameId: msg.data.id,
              hash: msg.data.hash,
              players: msg.data.players,
              countdown: msg.data.countdown || 0,
              crashPoint: msg.data.phase === 'crashed' ? msg.data.multiplier : null,
              myBet: null,
            };

          case 'game_waiting':
            return {
              ...prev,
              phase: 'waiting',
              multiplier: 1.00,
              elapsed: 0,
              countdown: msg.countdown,
              gameId: msg.nextGameId,
              players: [],
              crashPoint: null,
              myBet: null,
              error: null,
            };

          case 'game_start':
            return {
              ...prev,
              phase: 'running',
              multiplier: 1.00,
              elapsed: 0,
              gameId: msg.gameId,
              hash: msg.hash,
              crashPoint: null,
            };

          case 'game_tick':
            return { ...prev, multiplier: msg.multiplier, elapsed: msg.elapsed };

          case 'game_crash':
            return { ...prev, phase: 'crashed', crashPoint: msg.crashPoint, multiplier: msg.crashPoint };

          case 'player_bet':
            return { ...prev, players: [...prev.players, msg.bet] };

          case 'player_cashout':
            return {
              ...prev,
              players: prev.players.map(p =>
                p.betId === msg.bet.betId ? msg.bet : p
              ),
            };

          case 'bet_placed':
            return { ...prev, myBet: msg.bet };

          case 'bet_cashout':
            return { ...prev, myBet: msg.bet };

          case 'balance_update':
            return { ...prev, balance: msg.balance };

          case 'history':
            return { ...prev, history: msg.games };

          case 'chat':
            return {
              ...prev,
              chatMessages: [...prev.chatMessages.slice(-99), msg.msg],
            };

          case 'chat_history':
            return { ...prev, chatMessages: msg.messages };

          case 'achievement_unlocked':
            return { ...prev, newAchievement: msg.achievement };

          case 'error':
            return { ...prev, error: msg.message };

          default:
            return prev;
        }
      });
    };
  }, []);

  // Reconnect when user changes (login/logout)
  useEffect(() => {
    wsRef.current?.close();
    connect();
    return () => { wsRef.current?.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const send = useCallback((msg: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const placeBet = useCallback((amount: number, autoCashOut?: number) => {
    send({ type: 'place_bet', amount, autoCashOut });
  }, [send]);

  const cashOut = useCallback(() => {
    send({ type: 'cash_out' });
  }, [send]);

  const sendChat = useCallback((message: string) => {
    send({ type: 'chat_message', message });
  }, [send]);

  const clearError = useCallback(() => {
    setData(prev => ({ ...prev, error: null }));
  }, []);

  const clearAchievement = useCallback(() => {
    setData(prev => ({ ...prev, newAchievement: null }));
  }, []);

  return { ...data, connected, placeBet, cashOut, sendChat, clearError, clearAchievement };
}
