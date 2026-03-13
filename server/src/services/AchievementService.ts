import prisma from '../utils/prisma';
import { AchievementData } from '../types';

// XP required per level: level N needs N * 100 XP
function xpForLevel(level: number): number {
  return level * 100;
}

export class AchievementService {
  private static definitions: { code: string; name: string; description: string; icon: string; xp: number; check: (stats: UserStats) => boolean }[] = [
    { code: 'FIRST_BET', name: 'Новичок', description: 'Сделай первую ставку', icon: '🎯', xp: 10, check: s => s.gamesPlayed >= 1 },
    { code: 'GAMES_10', name: 'Игрок', description: 'Сыграй 10 раундов', icon: '🎮', xp: 25, check: s => s.gamesPlayed >= 10 },
    { code: 'GAMES_100', name: 'Ветеран', description: 'Сыграй 100 раундов', icon: '⭐', xp: 100, check: s => s.gamesPlayed >= 100 },
    { code: 'GAMES_1000', name: 'Легенда', description: 'Сыграй 1000 раундов', icon: '👑', xp: 500, check: s => s.gamesPlayed >= 1000 },
    { code: 'WIN_2X', name: 'Дубль', description: 'Поймай 2x множитель', icon: '✌️', xp: 15, check: s => s.maxMultiplier >= 2 },
    { code: 'WIN_5X', name: 'Ракета', description: 'Поймай 5x множитель', icon: '🚀', xp: 50, check: s => s.maxMultiplier >= 5 },
    { code: 'WIN_10X', name: 'Лунатик', description: 'Поймай 10x множитель', icon: '🌙', xp: 100, check: s => s.maxMultiplier >= 10 },
    { code: 'WIN_50X', name: 'Астронавт', description: 'Поймай 50x множитель', icon: '🧑‍🚀', xp: 300, check: s => s.maxMultiplier >= 50 },
    { code: 'WIN_100X', name: 'Космонавт', description: 'Поймай 100x множитель', icon: '🛸', xp: 1000, check: s => s.maxMultiplier >= 100 },
    { code: 'PROFIT_100', name: 'Сотка', description: 'Заработай $100 профита', icon: '💵', xp: 30, check: s => s.totalProfit >= 100 },
    { code: 'PROFIT_1000', name: 'Тысячник', description: 'Заработай $1,000 профита', icon: '💰', xp: 150, check: s => s.totalProfit >= 1000 },
    { code: 'PROFIT_10000', name: 'Магнат', description: 'Заработай $10,000 профита', icon: '🏦', xp: 500, check: s => s.totalProfit >= 10000 },
    { code: 'WAGERED_1000', name: 'Хайроллер', description: 'Поставь $1,000', icon: '🎰', xp: 50, check: s => s.totalWagered >= 1000 },
    { code: 'WAGERED_10000', name: 'Кит', description: 'Поставь $10,000', icon: '🐋', xp: 200, check: s => s.totalWagered >= 10000 },
    { code: 'STREAK_3', name: 'Три подряд', description: 'Выиграй 3 раунда подряд', icon: '🔥', xp: 40, check: s => s.winStreak >= 3 },
    { code: 'STREAK_5', name: 'Горячий', description: 'Выиграй 5 раундов подряд', icon: '🔥🔥', xp: 100, check: s => s.winStreak >= 5 },
    { code: 'DAILY_7', name: 'Постоянство', description: 'Забери 7 ежедневных бонусов подряд', icon: '📅', xp: 75, check: s => s.dailyStreak >= 7 },
  ];

  static async seedAchievements() {
    for (const def of this.definitions) {
      await prisma.achievement.upsert({
        where: { code: def.code },
        update: { name: def.name, description: def.description, icon: def.icon, xpReward: def.xp },
        create: { code: def.code, name: def.name, description: def.description, icon: def.icon, xpReward: def.xp },
      });
    }
    console.log(`[Achievements] Seeded ${this.definitions.length} achievements`);
  }

  static async checkAndGrant(userId: string, stats: UserStats): Promise<AchievementData[]> {
    const existing = await prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });
    const existingCodes = new Set(existing.map(e => e.achievement.code));

    const newAchievements: AchievementData[] = [];

    for (const def of this.definitions) {
      if (existingCodes.has(def.code)) continue;
      if (!def.check(stats)) continue;

      const achievement = await prisma.achievement.findUnique({ where: { code: def.code } });
      if (!achievement) continue;

      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });

      // Add XP
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        let newXp = user.xp + def.xp;
        let newLevel = user.level;
        while (newXp >= xpForLevel(newLevel + 1)) {
          newXp -= xpForLevel(newLevel + 1);
          newLevel++;
        }
        await prisma.user.update({
          where: { id: userId },
          data: { xp: newXp, level: newLevel },
        });
      }

      newAchievements.push({
        code: def.code,
        name: def.name,
        description: def.description,
        icon: def.icon,
        xpReward: def.xp,
      });
    }

    return newAchievements;
  }

  static async getUserAchievements(userId: string) {
    const all = await prisma.achievement.findMany();
    const unlocked = await prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });
    const unlockedCodes = new Set(unlocked.map(u => u.achievement.code));

    return all.map(a => ({
      code: a.code,
      name: a.name,
      description: a.description,
      icon: a.icon,
      xpReward: a.xpReward,
      unlocked: unlockedCodes.has(a.code),
      unlockedAt: unlocked.find(u => u.achievement.code === a.code)?.unlockedAt || null,
    }));
  }
}

export interface UserStats {
  gamesPlayed: number;
  totalWagered: number;
  totalProfit: number;
  maxMultiplier: number;
  winStreak: number;
  dailyStreak: number;
}
