import { motion } from 'framer-motion';
import type { GameHistoryItem } from '@/types';

interface Props {
  history: GameHistoryItem[];
}

function getCrashColor(point: number): string {
  if (point < 1.5) return 'text-danger';
  if (point < 2) return 'text-warning';
  if (point < 5) return 'text-accent';
  return 'text-purple';
}

function getCrashBg(point: number): string {
  if (point < 1.5) return 'bg-danger/10';
  if (point < 2) return 'bg-warning/10';
  if (point < 5) return 'bg-accent/10';
  return 'bg-purple/10';
}

export function GameHistory({ history }: Props) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-white/5">
      <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">
        История игр
      </h3>

      <div className="flex flex-wrap gap-1.5">
        {history.slice(0, 30).map((game, i) => (
          <motion.div
            key={game.id}
            initial={i === 0 ? { scale: 0, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums cursor-pointer
              ${getCrashBg(game.crashPoint)} ${getCrashColor(game.crashPoint)}
              hover:brightness-125 transition`}
            title={`Hash: ${game.hash}`}
          >
            {game.crashPoint.toFixed(2)}x
          </motion.div>
        ))}
      </div>
    </div>
  );
}
