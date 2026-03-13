import { useEffect, useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Header } from '@/components/Layout/Header';
import { CrashChart } from '@/components/Game/CrashChart';
import { BetPanel } from '@/components/Betting/BetPanel';
import { GameHistory } from '@/components/History/GameHistory';
import { PlayersList } from '@/components/Game/PlayersList';
import ChatPanel from '@/components/Chat/ChatPanel';
import { AchievementToast } from '@/components/Game/AchievementToast';
import { DailyBonusModal } from '@/components/Bonus/DailyBonusModal';
import { PromoCodeInput } from '@/components/Bonus/PromoCodeInput';
import Starfield from '@/components/Game/Starfield';
import RocketAnimation from '@/components/Game/RocketAnimation';
import { motion, AnimatePresence } from 'framer-motion';

const LeaderboardPanel = lazy(() => import('@/components/Leaderboard/LeaderboardPanel').then(m => ({ default: m.LeaderboardPanel })));
const ProfilePanel = lazy(() => import('@/components/Profile/ProfilePanel').then(m => ({ default: m.ProfilePanel })));
const AdminPanel = lazy(() => import('@/components/Admin/AdminPanel'));
const AutoBetPanel = lazy(() => import('@/components/Betting/AutoBetPanel').then(m => ({ default: m.AutoBetPanel })));

type Tab = 'game' | 'leaderboard' | 'profile' | 'admin';

function GamePage() {
  const { user, updateBalance } = useAuth();
  const {
    phase, multiplier, elapsed, gameId, hash,
    players, countdown, crashPoint, history,
    balance: wsBalance, myBet, error,
    chatMessages, newAchievement,
    connected, placeBet, cashOut, sendChat, clearError, clearAchievement,
  } = useWebSocket(user?.id);

  const [activeTab, setActiveTab] = useState<Tab>('game');
  const [dailyOpen, setDailyOpen] = useState(false);

  useEffect(() => {
    if (wsBalance > 0) updateBalance(wsBalance);
  }, [wsBalance, updateBalance]);

  const balance = user?.balance ?? wsBalance;

  return (
    <div className="min-h-screen flex flex-col relative">
      <Header
        balance={balance}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenDaily={() => setDailyOpen(true)}
      />

      <AchievementToast achievement={newAchievement} onDismiss={clearAchievement} />
      <DailyBonusModal isOpen={dailyOpen} onClose={() => setDailyOpen(false)} onClaim={(b) => { updateBalance(b); setDailyOpen(false); }} />

      {activeTab === 'game' && (
        <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-4">
          {!connected && (
            <div className="bg-warning/10 text-warning px-4 py-2 rounded-xl text-sm text-center mb-4">
              Подключение к серверу...
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-danger/10 text-danger px-4 py-2 rounded-xl text-sm text-center cursor-pointer mb-4"
                onClick={clearError}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <GameHistory history={history} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
            <div className="lg:col-span-8 space-y-4">
              <div className="relative">
                <Starfield phase={phase} multiplier={multiplier} />
                <CrashChart phase={phase} multiplier={multiplier} elapsed={elapsed} crashPoint={crashPoint} countdown={countdown} />
                <RocketAnimation phase={phase} multiplier={multiplier} elapsed={elapsed} crashPoint={crashPoint} />
              </div>
              <PlayersList players={players} />
            </div>

            <div className="lg:col-span-4 space-y-4">
              <BetPanel phase={phase} multiplier={multiplier} myBet={myBet} balance={balance} onPlaceBet={placeBet} onCashOut={cashOut} />

              <Suspense fallback={null}>
                <AutoBetPanel phase={phase} onPlaceBet={placeBet} balance={balance} isActive={false} />
              </Suspense>

              {user && <PromoCodeInput onSuccess={(_a, b) => updateBalance(b)} />}

              <ChatPanel messages={chatMessages} onSend={sendChat} user={user} />
            </div>
          </div>
        </main>
      )}

      {activeTab === 'leaderboard' && (
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
          <Suspense fallback={<div className="text-center text-gray-500 py-8">Загрузка...</div>}>
            <LeaderboardPanel />
          </Suspense>
        </main>
      )}

      {activeTab === 'profile' && user && (
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
          <Suspense fallback={<div className="text-center text-gray-500 py-8">Загрузка...</div>}>
            <ProfilePanel />
          </Suspense>
        </main>
      )}

      {activeTab === 'admin' && user?.role === 'ADMIN' && (
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4">
          <Suspense fallback={<div className="text-center text-gray-500 py-8">Загрузка...</div>}>
            <AdminPanel />
          </Suspense>
        </main>
      )}

      <footer className="text-center text-gray-600 text-xs py-4 border-t border-white/5">
        Provably Fair | Game #{gameId.slice(0, 8)}
        {phase === 'crashed' && hash && (
          <span className="ml-2 text-gray-500">Hash: {hash.slice(0, 16)}...</span>
        )}
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GamePage />
    </AuthProvider>
  );
}
