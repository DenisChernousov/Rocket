import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Trophy, TrendingUp, DollarSign, Target,
  Zap, Calendar, Copy, Check, Gift, Star, Lock,
} from 'lucide-react';
import type { PlayerProfile, AchievementData } from '@/types';
import { api } from '@/services/api';

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-danger/20 text-danger',
  moderator: 'bg-purple/20 text-purple',
  vip: 'bg-yellow-400/20 text-yellow-400',
  user: 'bg-white/10 text-gray-400',
};

const STAT_ITEMS = [
  { key: 'gamesPlayed', label: 'Игр сыграно', icon: Target, format: (v: number) => v.toLocaleString() },
  { key: 'winRate', label: 'Процент побед', icon: TrendingUp, format: (v: number) => `${v.toFixed(1)}%` },
  { key: 'totalWagered', label: 'Всего поставлено', icon: DollarSign, format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'totalProfit', label: 'Общий профит', icon: Zap, format: (v: number) => `${v >= 0 ? '+' : ''}$${v.toFixed(2)}`, color: (v: number) => v >= 0 ? 'text-accent' : 'text-danger' },
  { key: 'bestWin', label: 'Лучший выигрыш', icon: Trophy, format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'bestMultiplier', label: 'Лучший множитель', icon: Star, format: (v: number) => `${v.toFixed(2)}x` },
] as const;

export function ProfilePanel() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [referralInfo, setReferralInfo] = useState<{
    code: string;
    referrals: number;
    earnings: number;
  } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const [profileData, refData] = await Promise.all([
          api.game.profile() as Promise<PlayerProfile>,
          api.bonus.referralInfo() as Promise<{ code: string; referrals: number; earnings: number }>,
        ]);
        setProfile(profileData);
        setReferralInfo(refData);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const copyReferralCode = async () => {
    const code = referralInfo?.code || profile?.referralCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (loading) {
    return (
      <div className="bg-surface rounded-2xl border border-white/5 p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-surface rounded-2xl border border-white/5 p-8 text-center text-gray-500">
        Не удалось загрузить профиль
      </div>
    );
  }

  const xpPercent = profile.xpForNext > 0
    ? Math.min((profile.xp / profile.xpForNext) * 100, 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* User info card */}
      <div className="bg-surface rounded-2xl border border-white/5 p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/30 to-purple/30 flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-bold text-xl">{profile.username}</h2>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium uppercase ${ROLE_COLORS[profile.role] || ROLE_COLORS.user}`}>
                {profile.role}
              </span>
            </div>

            {/* Level + XP bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-gray-400">
                  Уровень <span className="text-accent font-bold">{profile.level}</span>
                </span>
                <span className="text-xs text-gray-500 tabular-nums">
                  {profile.xp} / {profile.xpForNext} XP
                </span>
              </div>
              <div className="h-2 bg-bg rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-accent to-accent/70 rounded-full"
                />
              </div>
            </div>

            {/* Daily streak + member since */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-sm">
                <Gift className="w-4 h-4 text-warning" />
                <span className="text-gray-400">Серия:</span>
                <span className="text-white font-medium">{profile.dailyStreak} дн.</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400">С</span>
                <span className="text-gray-300">
                  {new Date(profile.createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {STAT_ITEMS.map((stat, i) => {
          const Icon = stat.icon;
          const value = profile[stat.key] as number;
          const colorFn = 'color' in stat ? stat.color : undefined;
          return (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-surface rounded-xl border border-white/5 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-500">{stat.label}</span>
              </div>
              <span className={`text-lg font-bold tabular-nums ${
                colorFn ? colorFn(value) : 'text-white'
              }`}>
                {stat.format(value)}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Referral section */}
      <div className="bg-surface rounded-2xl border border-white/5 p-5">
        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4 text-purple" />
          Реферальная программа
        </h3>

        <div className="space-y-3">
          {/* Referral code */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-bg rounded-lg px-4 py-2.5 border border-white/10 text-white font-mono text-sm tabular-nums">
              {referralInfo?.code || profile.referralCode}
            </div>
            <motion.button
              onClick={copyReferralCode}
              whileTap={{ scale: 0.9 }}
              className={`p-2.5 rounded-lg transition ${
                copied
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-light text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </motion.button>
          </div>

          {/* Referral stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg rounded-lg p-3 border border-white/5">
              <span className="text-xs text-gray-500 block mb-1">Рефералов</span>
              <span className="text-white font-bold text-lg">{referralInfo?.referrals ?? 0}</span>
            </div>
            <div className="bg-bg rounded-lg p-3 border border-white/5">
              <span className="text-xs text-gray-500 block mb-1">Заработано</span>
              <span className="text-accent font-bold text-lg">${(referralInfo?.earnings ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="bg-surface rounded-2xl border border-white/5 p-5">
        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          Достижения
          <span className="text-xs text-gray-500 font-normal ml-auto">
            {profile.achievements.filter(a => a.unlocked).length}/{profile.achievements.length}
          </span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {profile.achievements.map((ach, i) => (
            <AchievementCard key={ach.code} achievement={ach} index={i} />
          ))}
        </div>

        {profile.achievements.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Достижений пока нет
          </div>
        )}
      </div>
    </div>
  );
}

function AchievementCard({ achievement, index }: { achievement: AchievementData; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03 }}
      className={`relative p-3 rounded-xl border transition-all ${
        achievement.unlocked
          ? 'bg-gradient-to-br from-accent/10 to-purple/10 border-accent/20'
          : 'bg-surface-light border-white/5 opacity-50 grayscale'
      }`}
    >
      <div className="text-2xl mb-1.5">{achievement.icon}</div>
      <div className={`text-xs font-medium mb-0.5 ${
        achievement.unlocked ? 'text-white' : 'text-gray-500'
      }`}>
        {achievement.name}
      </div>
      <div className="text-[10px] text-gray-500 leading-tight">{achievement.description}</div>
      <div className="mt-1.5 text-[10px] text-purple font-medium">
        +{achievement.xpReward} XP
      </div>

      {!achievement.unlocked && (
        <div className="absolute top-2 right-2">
          <Lock className="w-3 h-3 text-gray-600" />
        </div>
      )}
    </motion.div>
  );
}
