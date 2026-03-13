import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { GamePhase, PublicBet } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface Props {
  phase: GamePhase;
  multiplier: number;
  myBet: PublicBet | null;
  balance: number;
  onPlaceBet: (amount: number, autoCashOut?: number) => void;
  onCashOut: () => void;
}

export function BetPanel({ phase, multiplier, myBet, balance, onPlaceBet, onCashOut }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('10');
  const [autoCashOut, setAutoCashOut] = useState('');
  const [betPlaced, setBetPlaced] = useState(false);

  // Reset when new round starts
  useEffect(() => {
    if (phase === 'waiting') {
      setBetPlaced(false);
    }
  }, [phase]);

  useEffect(() => {
    if (myBet) setBetPlaced(true);
  }, [myBet]);

  const canBet = phase === 'waiting' && !betPlaced && user;
  const canCashOut = phase === 'running' && betPlaced && myBet && !myBet.cashOutAt;
  const potentialWin = betPlaced && myBet && !myBet.cashOutAt
    ? (myBet.amount * multiplier).toFixed(2)
    : null;

  const handleBet = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 1) return;
    const auto = autoCashOut ? parseFloat(autoCashOut) : undefined;
    onPlaceBet(amt, auto && auto >= 1.01 ? auto : undefined);
  };

  const quickAmounts = [5, 10, 50, 100, 500];

  if (!user) {
    return (
      <div className="bg-surface rounded-2xl p-6 border border-white/5">
        <div className="text-center text-gray-400 py-8">
          <div className="text-lg mb-2">Войдите для игры</div>
          <div className="text-sm text-gray-500">Авторизуйтесь чтобы делать ставки</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl p-5 border border-white/5 space-y-4">
      {/* Balance */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm">Баланс</span>
        <span className="text-accent font-bold text-lg tabular-nums">
          ${balance.toFixed(2)}
        </span>
      </div>

      {/* Bet amount */}
      <div>
        <label className="text-gray-400 text-xs mb-1.5 block">Ставка</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            disabled={!canBet}
            className="w-full bg-bg border border-white/10 rounded-xl pl-7 pr-4 py-3 text-white text-lg font-medium
              focus:outline-none focus:border-accent/50 transition disabled:opacity-50 tabular-nums"
            min="1"
            step="1"
          />
        </div>

        {/* Quick amounts */}
        <div className="flex gap-2 mt-2">
          {quickAmounts.map(q => (
            <button
              key={q}
              onClick={() => setAmount(String(q))}
              disabled={!canBet}
              className="flex-1 py-1.5 rounded-lg bg-surface-light text-gray-400 text-xs font-medium
                hover:bg-white/10 hover:text-white transition disabled:opacity-30"
            >
              ${q}
            </button>
          ))}
        </div>
      </div>

      {/* Auto cash-out */}
      <div>
        <label className="text-gray-400 text-xs mb-1.5 block">Авто-вывод (x)</label>
        <input
          type="number"
          value={autoCashOut}
          onChange={e => setAutoCashOut(e.target.value)}
          disabled={!canBet}
          placeholder="Отключено"
          className="w-full bg-bg border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
            focus:outline-none focus:border-accent/50 transition disabled:opacity-50 tabular-nums"
          min="1.01"
          step="0.01"
        />
      </div>

      {/* Action button */}
      {canCashOut ? (
        <motion.button
          onClick={onCashOut}
          whileTap={{ scale: 0.95 }}
          className="w-full py-4 rounded-xl bg-warning text-black font-bold text-lg
            hover:bg-yellow-400 transition relative overflow-hidden"
        >
          <div>Забрать ${potentialWin}</div>
          <div className="text-xs font-medium opacity-70">@ {multiplier.toFixed(2)}x</div>
        </motion.button>
      ) : (
        <motion.button
          onClick={handleBet}
          disabled={!canBet}
          whileTap={canBet ? { scale: 0.95 } : {}}
          className={`w-full py-4 rounded-xl font-bold text-lg transition
            ${canBet
              ? 'bg-accent text-black hover:bg-accent-dark cursor-pointer'
              : betPlaced
                ? 'bg-surface-light text-gray-500 cursor-not-allowed'
                : 'bg-surface-light text-gray-600 cursor-not-allowed'
            }`}
        >
          {phase === 'waiting' && !betPlaced && 'Поставить'}
          {phase === 'waiting' && betPlaced && 'Ставка принята'}
          {phase === 'running' && betPlaced && myBet?.cashOutAt && `Выигрыш: $${myBet.profit?.toFixed(2)}`}
          {phase === 'running' && !betPlaced && 'Ожидание...'}
          {phase === 'crashed' && myBet?.cashOutAt && `Выигрыш +$${myBet.profit?.toFixed(2)}`}
          {phase === 'crashed' && myBet && !myBet.cashOutAt && 'Проигрыш'}
          {phase === 'crashed' && !myBet && 'Ожидание раунда'}
        </motion.button>
      )}
    </div>
  );
}
