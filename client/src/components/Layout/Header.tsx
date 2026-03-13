import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from '@/components/Auth/AuthModal';
import { Rocket, LogOut, Gift, Trophy, User, Shield } from 'lucide-react';

type Tab = 'game' | 'leaderboard' | 'profile' | 'admin';

interface Props {
  balance: number;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onOpenDaily: () => void;
}

export function Header({ balance, activeTab, onTabChange, onOpenDaily }: Props) {
  const { user, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const tabs: { key: Tab; label: string; icon: typeof Rocket; show: boolean }[] = [
    { key: 'game', label: 'Игра', icon: Rocket, show: true },
    { key: 'leaderboard', label: 'Топ', icon: Trophy, show: true },
    { key: 'profile', label: 'Профиль', icon: User, show: !!user },
    { key: 'admin', label: 'Админ', icon: Shield, show: user?.role === 'ADMIN' },
  ];

  return (
    <>
      <header className="bg-surface border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo + Nav */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onTabChange('game')}>
              <Rocket className="w-6 h-6 text-accent" />
              <span className="font-black text-lg text-white tracking-tight">CRASH</span>
            </div>

            <nav className="hidden sm:flex items-center gap-1 ml-4">
              {tabs.filter(t => t.show).map(t => (
                <button
                  key={t.key}
                  onClick={() => onTabChange(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition
                    ${activeTab === t.key
                      ? 'bg-accent/10 text-accent'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <t.icon size={14} />
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Daily bonus button */}
                <button
                  onClick={onOpenDaily}
                  className="text-warning hover:text-yellow-300 transition"
                  title="Ежедневный бонус"
                >
                  <Gift size={20} />
                </button>

                {/* Balance */}
                <div className="bg-bg px-3 py-1.5 rounded-xl border border-white/10">
                  <span className="text-accent font-bold text-sm tabular-nums">
                    ${balance.toFixed(2)}
                  </span>
                </div>

                {/* Level badge */}
                <div className="hidden sm:flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
                    {user.level}
                  </div>
                  <span className="text-gray-400 text-sm">{user.username}</span>
                </div>

                <button
                  onClick={logout}
                  className="text-gray-500 hover:text-white transition"
                  title="Выйти"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="bg-accent text-black px-4 py-1.5 rounded-xl text-sm font-bold
                  hover:bg-accent-dark transition"
              >
                Войти
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex border-t border-white/5">
          {tabs.filter(t => t.show).map(t => (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition
                ${activeTab === t.key ? 'text-accent' : 'text-gray-500'}`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
