import { motion } from 'framer-motion';
import type { PublicBet } from '@/types';

interface Props {
  players: PublicBet[];
}

export function PlayersList({ players }: Props) {
  const sorted = [...players].sort((a, b) => b.amount - a.amount);

  return (
    <div className="bg-surface rounded-2xl p-4 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider">
          Игроки
        </h3>
        <span className="text-gray-500 text-xs">{players.length}</span>
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {sorted.length === 0 && (
          <div className="text-gray-600 text-xs text-center py-4">
            Нет ставок
          </div>
        )}

        {sorted.map((player, i) => (
          <motion.div
            key={player.betId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02 }}
            className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-sm
              ${player.cashOutAt ? 'bg-accent/5' : ''}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-surface-light flex items-center justify-center text-[10px] font-bold text-gray-400 flex-shrink-0">
                {player.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-gray-300 truncate text-xs">{player.username}</span>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-gray-400 text-xs tabular-nums">${player.amount.toFixed(2)}</span>
              {player.cashOutAt && (
                <span className="text-accent text-xs font-bold tabular-nums">
                  {player.cashOutAt.toFixed(2)}x
                </span>
              )}
              {player.profit !== null && player.profit > 0 && (
                <span className="text-accent text-xs tabular-nums">
                  +${player.profit.toFixed(2)}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
