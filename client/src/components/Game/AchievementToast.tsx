import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AchievementData } from '@/types';

interface Props {
  achievement: AchievementData | null;
  onDismiss: () => void;
}

export function AchievementToast({ achievement, onDismiss }: Props) {
  useEffect(() => {
    if (achievement) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onDismiss]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          className="fixed top-4 right-4 z-50 bg-surface border border-accent/30 rounded-2xl p-4
            cursor-pointer max-w-xs"
          style={{ boxShadow: '0 0 30px rgba(16, 185, 129, 0.2)' }}
          onClick={onDismiss}
        >
          <div className="flex items-center gap-3">
            <div className="text-3xl">{achievement.icon}</div>
            <div>
              <div className="text-accent text-xs font-bold uppercase tracking-wider">
                Достижение!
              </div>
              <div className="text-white font-bold">{achievement.name}</div>
              <div className="text-gray-400 text-xs">{achievement.description}</div>
              <div className="text-accent text-xs mt-1">+{achievement.xpReward} XP</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
