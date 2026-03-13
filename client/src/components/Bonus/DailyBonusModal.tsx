import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Check, X, Sparkles, Clock } from 'lucide-react';
import { api } from '@/services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onClaim: (balance: number) => void;
}

interface DailyReward {
  day: number;
  amount: number;
  claimed?: boolean;
}

interface DailyStatus {
  claimed: boolean;
  streak: number;
  nextReward: number;
  rewards: DailyReward[];
  nextAvailable: string | null;
}

const DEFAULT_REWARDS = [10, 15, 25, 40, 60, 100, 200];

export function DailyBonusModal({ isOpen, onClose, onClaim }: Props) {
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState(0);
  const [countdown, setCountdown] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.bonus.dailyStatus() as DailyStatus;
      setStatus(result);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setClaimed(false);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, fetchStatus]);

  // Countdown timer
  useEffect(() => {
    if (!status?.claimed || !status.nextAvailable) {
      setCountdown('');
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const next = new Date(status.nextAvailable!).getTime();
      const diff = next - now;

      if (diff <= 0) {
        setCountdown('');
        fetchStatus();
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateCountdown();
    intervalRef.current = setInterval(updateCountdown, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, fetchStatus]);

  const handleClaim = async () => {
    if (claiming || status?.claimed) return;
    setClaiming(true);
    try {
      const result = await api.bonus.claimDaily() as {
        amount: number;
        streak: number;
        day: number;
        balance: number;
        rewards: DailyReward[];
      };
      setClaimedAmount(result.amount);
      setClaimed(true);
      onClaim(result.balance);

      // Update status locally
      setStatus(prev => prev ? {
        ...prev,
        claimed: true,
        streak: result.streak,
        rewards: result.rewards,
      } : prev);
    } catch {
      // silently fail
    } finally {
      setClaiming(false);
    }
  };

  const rewards = status?.rewards?.length
    ? status.rewards
    : DEFAULT_REWARDS.map((amount, i) => ({ day: i + 1, amount }));

  const currentDay = status ? (status.streak % 7) || 7 : 1;
  const isClaimed = status?.claimed || claimed;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="bg-surface rounded-2xl border border-white/10 w-full max-w-md overflow-hidden relative"
          >
            {/* Header */}
            <div className="relative px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">Ежедневный бонус</h2>
                    <p className="text-gray-500 text-xs">
                      Серия: {status?.streak ?? 0} дней
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Rewards grid */}
            <div className="px-6 pb-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {rewards.map((reward, i) => {
                    const day = reward.day ?? i + 1;
                    const isPast = day < currentDay;
                    const isCurrent = day === currentDay;
                    const wasClaimed = reward.claimed || isPast;
                    const isCurrentClaimed = isCurrent && isClaimed;

                    return (
                      <motion.div
                        key={day}
                        initial={false}
                        animate={
                          isCurrent && !isClaimed
                            ? {
                                boxShadow: [
                                  '0 0 0 0 rgba(16,185,129,0)',
                                  '0 0 20px 4px rgba(16,185,129,0.3)',
                                  '0 0 0 0 rgba(16,185,129,0)',
                                ],
                              }
                            : {}
                        }
                        transition={
                          isCurrent && !isClaimed
                            ? { duration: 2, repeat: Infinity }
                            : {}
                        }
                        className={`relative flex flex-col items-center py-2.5 rounded-xl border transition-all ${
                          isCurrent && !isClaimed
                            ? 'bg-accent/15 border-accent/40 ring-1 ring-accent/20'
                            : isCurrentClaimed
                              ? 'bg-accent/10 border-accent/20'
                              : wasClaimed
                                ? 'bg-white/5 border-white/5'
                                : 'bg-surface-light border-white/5'
                        }`}
                      >
                        <span className="text-[10px] text-gray-500 mb-1">
                          День {day}
                        </span>
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            isCurrent && !isClaimed
                              ? 'text-accent'
                              : wasClaimed || isCurrentClaimed
                                ? 'text-gray-500'
                                : 'text-gray-400'
                          }`}
                        >
                          ${reward.amount}
                        </span>

                        {/* Checkmark for claimed days */}
                        {(wasClaimed || isCurrentClaimed) && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center"
                          >
                            <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Claim section */}
            <div className="px-6 pb-6">
              {claimed ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative"
                >
                  {/* Sparkle animation */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{
                          opacity: 1,
                          x: '50%',
                          y: '50%',
                          scale: 0,
                        }}
                        animate={{
                          opacity: [1, 0],
                          x: `${50 + (Math.random() - 0.5) * 100}%`,
                          y: `${50 + (Math.random() - 0.5) * 100}%`,
                          scale: [0, 1],
                        }}
                        transition={{ duration: 0.8, delay: i * 0.05 }}
                        className="absolute w-2 h-2"
                      >
                        <Sparkles className="w-full h-full text-yellow-400" />
                      </motion.div>
                    ))}
                  </div>

                  <div className="bg-accent/10 border border-accent/20 rounded-xl py-5 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                      className="text-3xl font-bold text-accent mb-1"
                    >
                      +${claimedAmount}
                    </motion.div>
                    <span className="text-gray-400 text-sm">Бонус получен!</span>
                  </div>
                </motion.div>
              ) : isClaimed && countdown ? (
                <div className="bg-surface-light rounded-xl py-4 text-center border border-white/5">
                  <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Следующий бонус через</span>
                  </div>
                  <span className="text-2xl font-bold text-white tabular-nums">{countdown}</span>
                </div>
              ) : (
                <motion.button
                  onClick={handleClaim}
                  disabled={claiming || loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-4 rounded-xl bg-accent text-black font-bold text-lg
                    hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {claiming ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      <span>Получение...</span>
                    </div>
                  ) : (
                    `\u0417\u0430\u0431\u0440\u0430\u0442\u044C $${status?.nextReward ?? DEFAULT_REWARDS[currentDay - 1]}`
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
