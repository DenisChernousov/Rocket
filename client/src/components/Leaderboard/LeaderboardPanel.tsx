import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp, DollarSign, RefreshCw } from 'lucide-react';
import type { LeaderboardEntry } from '@/types';
import { api } from '@/services/api';

type Period = 'today' | 'week' | 'month' | 'all';

interface BigWin {
  username: string;
  multiplier: number;
  amount: number;
}

interface TopPayout {
  username: string;
  profit: number;
  multiplier: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  bigWins: BigWin[];
  topPayouts: TopPayout[];
  period: Period;
}

type Tab = 'winners' | 'multipliers' | 'payouts';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Сегодня' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'all', label: 'Все время' },
];

const TABS: { key: Tab; label: string; icon: typeof Trophy }[] = [
  { key: 'winners', label: 'Топ игроков', icon: Trophy },
  { key: 'multipliers', label: 'Множители', icon: TrendingUp },
  { key: 'payouts', label: 'Выплаты', icon: DollarSign },
];

function getRankColor(rank: number): string {
  if (rank === 1) return 'text-yellow-400';
  if (rank === 2) return 'text-gray-300';
  if (rank === 3) return 'text-amber-600';
  return 'text-gray-500';
}

function getRankBg(rank: number): string {
  if (rank === 1) return 'bg-yellow-400/10 border-yellow-400/20';
  if (rank === 2) return 'bg-gray-300/5 border-gray-300/10';
  if (rank === 3) return 'bg-amber-600/10 border-amber-600/15';
  return 'bg-transparent border-transparent';
}

function LevelBadge({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold bg-purple/20 text-purple ml-1.5">
      {level}
    </span>
  );
}

export function LeaderboardPanel() {
  const [period, setPeriod] = useState<Period>('today');
  const [tab, setTab] = useState<Tab>('winners');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await api.leaderboard.get(period);
      setData(result as LeaderboardData);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Лидерборд
        </h2>
        <motion.button
          onClick={() => fetchData(true)}
          animate={refreshing ? { rotate: 360 } : {}}
          transition={{ duration: 1, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
          className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </motion.button>
      </div>

      {/* Period selector */}
      <div className="px-5 mb-3">
        <div className="flex gap-1 bg-bg rounded-xl p-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition ${
                period === p.key
                  ? 'bg-accent text-black'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section tabs */}
      <div className="px-5 mb-3">
        <div className="flex gap-1">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                  tab === t.key
                    ? 'bg-surface-light text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-5 min-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${period}-${tab}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {tab === 'winners' && <WinnersTable entries={data?.leaderboard ?? []} />}
              {tab === 'multipliers' && <MultipliersTable entries={data?.bigWins ?? []} />}
              {tab === 'payouts' && <PayoutsTable entries={data?.topPayouts ?? []} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function WinnersTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState text="Нет данных за этот период" />;
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-[40px_1fr_100px_80px] gap-2 px-3 py-2 text-[11px] text-gray-500 uppercase tracking-wider">
        <span>#</span>
        <span>Игрок</span>
        <span className="text-right">Профит</span>
        <span className="text-right">Побед</span>
      </div>

      {entries.map((entry, i) => {
        const rank = i + 1;
        return (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`grid grid-cols-[40px_1fr_100px_80px] gap-2 px-3 py-2.5 rounded-lg border ${getRankBg(rank)} items-center`}
          >
            <span className={`font-bold text-sm tabular-nums ${getRankColor(rank)}`}>
              {rank <= 3 ? ['', '\u{1F947}', '\u{1F948}', '\u{1F949}'][rank] : rank}
            </span>
            <div className="flex items-center min-w-0">
              <span className="text-white font-medium text-sm truncate">{entry.username}</span>
              <LevelBadge level={entry.level} />
            </div>
            <span className={`text-right text-sm font-medium tabular-nums ${
              entry.totalProfit >= 0 ? 'text-accent' : 'text-danger'
            }`}>
              {entry.totalProfit >= 0 ? '+' : ''}${entry.totalProfit.toFixed(2)}
            </span>
            <span className="text-right text-sm text-gray-400 tabular-nums">{entry.gamesWon}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

function MultipliersTable({ entries }: { entries: BigWin[] }) {
  if (entries.length === 0) {
    return <EmptyState text="Нет данных за этот период" />;
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[40px_1fr_100px_80px] gap-2 px-3 py-2 text-[11px] text-gray-500 uppercase tracking-wider">
        <span>#</span>
        <span>Игрок</span>
        <span className="text-right">Множитель</span>
        <span className="text-right">Ставка</span>
      </div>

      {entries.map((entry, i) => {
        const rank = i + 1;
        return (
          <motion.div
            key={`${entry.username}-${i}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`grid grid-cols-[40px_1fr_100px_80px] gap-2 px-3 py-2.5 rounded-lg border ${getRankBg(rank)} items-center`}
          >
            <span className={`font-bold text-sm tabular-nums ${getRankColor(rank)}`}>
              {rank}
            </span>
            <span className="text-white font-medium text-sm truncate">{entry.username}</span>
            <span className="text-right text-sm font-bold tabular-nums text-warning">
              {entry.multiplier.toFixed(2)}x
            </span>
            <span className="text-right text-sm text-gray-400 tabular-nums">${entry.amount.toFixed(2)}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

function PayoutsTable({ entries }: { entries: TopPayout[] }) {
  if (entries.length === 0) {
    return <EmptyState text="Нет данных за этот период" />;
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[40px_1fr_100px_80px] gap-2 px-3 py-2 text-[11px] text-gray-500 uppercase tracking-wider">
        <span>#</span>
        <span>Игрок</span>
        <span className="text-right">Профит</span>
        <span className="text-right">Множитель</span>
      </div>

      {entries.map((entry, i) => {
        const rank = i + 1;
        return (
          <motion.div
            key={`${entry.username}-${i}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`grid grid-cols-[40px_1fr_100px_80px] gap-2 px-3 py-2.5 rounded-lg border ${getRankBg(rank)} items-center`}
          >
            <span className={`font-bold text-sm tabular-nums ${getRankColor(rank)}`}>
              {rank}
            </span>
            <span className="text-white font-medium text-sm truncate">{entry.username}</span>
            <span className="text-right text-sm font-bold tabular-nums text-accent">
              +${entry.profit.toFixed(2)}
            </span>
            <span className="text-right text-sm text-warning tabular-nums">{entry.multiplier.toFixed(2)}x</span>
          </motion.div>
        );
      })}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <Trophy className="w-10 h-10 mb-3 opacity-30" />
      <span className="text-sm">{text}</span>
    </div>
  );
}
