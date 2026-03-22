import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useSound } from '@/hooks/useSound';
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
import { BetResultOverlay } from '@/components/Game/BetResultOverlay';
import { BetSplash } from '@/components/Game/BetSplash';
import { LiveWinFeed } from '@/components/Game/LiveWinFeed';
import { api } from '@/services/api';
import type { RocketSkinId } from '@/components/Game/RocketSkins';
import { motion, AnimatePresence } from 'framer-motion';

const LeaderboardPanel = lazy(() => import('@/components/Leaderboard/LeaderboardPanel').then(m => ({ default: m.LeaderboardPanel })));
const ProfilePanel = lazy(() => import('@/components/Profile/ProfilePanel').then(m => ({ default: m.ProfilePanel })));
const AdminPanel = lazy(() => import('@/components/Admin/AdminPanel'));
const FairVerifier = lazy(() => import('@/components/Game/FairVerifier').then(m => ({ default: m.FairVerifier })));

type Tab = 'game' | 'leaderboard' | 'profile' | 'admin' | 'fair';

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
  const [rocketSkin, setRocketSkin] = useState<RocketSkinId>('classic');
  const sound = useSound();
  const prevPhaseRef = useRef(phase);

  useEffect(() => {
    if (wsBalance > 0) updateBalance(wsBalance);
  }, [wsBalance, updateBalance]);

  // Fetch public settings (rocket skin)
  useEffect(() => {
    api.settings.getPublic().then(s => {
      if (s.rocket_skin) setRocketSkin(s.rocket_skin as RocketSkinId);
    }).catch(() => {});
  }, []);

  // === Sound effects ===
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (prev === 'waiting' && phase === 'running') {
      // Game started — play bet sound if we have a bet
      if (myBet) sound.playBet();
    }
    if (phase === 'crashed' && prev === 'running') {
      sound.playCrash();
      // Check if we won
      if (myBet && myBet.profit !== null && myBet.profit >= 0) {
        setTimeout(() => sound.playWin(), 300);
      }
    }
  }, [phase, myBet, sound]);

  // Cashout sound
  useEffect(() => {
    if (myBet?.cashOutAt && myBet.profit !== null && myBet.profit >= 0) {
      sound.playCashOut();
    }
  }, [myBet?.cashOutAt, sound]);

  // Hotkeys: Space handled in BetPanel (has access to bet amount)

  const balance = user?.balance ?? wsBalance;

  return (
    <div className="min-h-screen flex flex-col relative">
      <Header
        balance={balance}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenDaily={() => setDailyOpen(true)}
        soundMuted={sound.muted}
        onToggleSound={sound.toggleMute}
        playersOnline={players.length}
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
                <CrashChart phase={phase} multiplier={multiplier} elapsed={elapsed} crashPoint={crashPoint} countdown={countdown}>
                  <RocketAnimation phase={phase} multiplier={multiplier} elapsed={elapsed} crashPoint={crashPoint} rocketSkin={rocketSkin} />
                </CrashChart>
                <BetSplash phase={phase} myBet={myBet} />
                <LiveWinFeed players={players} />
                <BetResultOverlay phase={phase} myBet={myBet} />
              </div>
              <PlayersList players={players} />
            </div>

            <div className="lg:col-span-4 space-y-4">
              <BetPanel phase={phase} multiplier={multiplier} myBet={myBet} balance={balance} onPlaceBet={placeBet} onCashOut={cashOut} />

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

      {activeTab === 'fair' && (
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
          <Suspense fallback={<div className="text-center text-gray-500 py-8">Загрузка...</div>}>
            <FairVerifier />
          </Suspense>
        </main>
      )}

      <footer className="text-center text-gray-600 text-xs py-4 border-t border-white/5">
        <div className="flex items-center justify-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent online-dot" />
            Provably Fair
          </span>
          <span className="text-gray-700">|</span>
          <span className="tabular-nums">Game #{gameId.slice(0, 8)}</span>
          {phase === 'crashed' && hash && (
            <>
              <span className="text-gray-700">|</span>
              <span className="text-gray-500 tabular-nums cursor-pointer hover:text-gray-400 transition" title={hash}>
                Hash: {hash.slice(0, 12)}...
              </span>
            </>
          )}
        </div>
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
