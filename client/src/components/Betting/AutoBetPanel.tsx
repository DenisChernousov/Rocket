import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Play, Square, Settings, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, BarChart3, AlertTriangle,
} from 'lucide-react';
import type { GamePhase } from '@/types';

interface Props {
  phase: GamePhase;
  onPlaceBet: (amount: number, autoCashOut?: number) => void;
  balance: number;
  isActive: boolean;
}

type Strategy = 'flat' | 'martingale' | 'anti-martingale' | 'custom';
type LossAction = 'reset' | 'increase';
type WinAction = 'reset' | 'increase';

interface AutoBetConfig {
  baseBet: number;
  autoCashOut: number;
  maxRounds: number; // 0 = infinite
  strategy: Strategy;
  onLoss: LossAction;
  lossIncreasePercent: number;
  onWin: WinAction;
  winIncreasePercent: number;
  stopOnProfit: number; // 0 = disabled
  stopOnLoss: number; // 0 = disabled
}

interface SessionStats {
  roundsPlayed: number;
  wins: number;
  losses: number;
  profit: number;
}

const STRATEGIES: { key: Strategy; label: string; description: string }[] = [
  { key: 'flat', label: 'Фиксированная', description: 'Одинаковая ставка каждый раунд' },
  { key: 'martingale', label: 'Мартингейл', description: 'Удвоение при проигрыше' },
  { key: 'anti-martingale', label: 'Анти-Мартингейл', description: 'Удвоение при выигрыше' },
  { key: 'custom', label: 'Пользовательская', description: 'Настройте поведение сами' },
];

const DEFAULT_CONFIG: AutoBetConfig = {
  baseBet: 10,
  autoCashOut: 2.0,
  maxRounds: 0,
  strategy: 'flat',
  onLoss: 'reset',
  lossIncreasePercent: 100,
  onWin: 'reset',
  winIncreasePercent: 100,
  stopOnProfit: 0,
  stopOnLoss: 0,
};

export function AutoBetPanel({ phase, onPlaceBet, balance, isActive }: Props) {
  const [config, setConfig] = useState<AutoBetConfig>(DEFAULT_CONFIG);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ roundsPlayed: 0, wins: 0, losses: 0, profit: 0 });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentBet, setCurrentBet] = useState(0);

  const runningRef = useRef(running);
  const configRef = useRef(config);
  const currentBetRef = useRef(currentBet);
  const prevPhaseRef = useRef(phase);

  runningRef.current = running;
  configRef.current = config;
  currentBetRef.current = currentBet;

  const updateConfig = (updates: Partial<AutoBetConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const resetStats = () => {
    setStats({ roundsPlayed: 0, wins: 0, losses: 0, profit: 0 });
    setCurrentBet(config.baseBet);
  };

  const calculateNextBet = useCallback((won: boolean): number => {
    const cfg = configRef.current;
    const cur = currentBetRef.current || cfg.baseBet;

    switch (cfg.strategy) {
      case 'flat':
        return cfg.baseBet;

      case 'martingale':
        return won ? cfg.baseBet : cur * 2;

      case 'anti-martingale':
        return won ? cur * 2 : cfg.baseBet;

      case 'custom': {
        if (won) {
          return cfg.onWin === 'reset'
            ? cfg.baseBet
            : cur * (1 + cfg.winIncreasePercent / 100);
        }
        return cfg.onLoss === 'reset'
          ? cfg.baseBet
          : cur * (1 + cfg.lossIncreasePercent / 100);
      }

      default:
        return cfg.baseBet;
    }
  }, []);

  const checkStopConditions = useCallback((newStats: SessionStats): boolean => {
    const cfg = configRef.current;

    if (cfg.stopOnProfit > 0 && newStats.profit >= cfg.stopOnProfit) return true;
    if (cfg.stopOnLoss > 0 && newStats.profit <= -cfg.stopOnLoss) return true;
    if (cfg.maxRounds > 0 && newStats.roundsPlayed >= cfg.maxRounds) return true;

    return false;
  }, []);

  const stopAutobet = useCallback(() => {
    setRunning(false);
  }, []);

  // Handle phase transitions for auto-betting
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (!runningRef.current) return;

    // When a new waiting phase starts (after crash), process the result
    if (phase === 'waiting' && prevPhase === 'crashed') {
      // isActive means the player cashed out successfully (win)
      const won = isActive;

      setStats(prev => {
        const roundProfit = won
          ? currentBetRef.current * (configRef.current.autoCashOut - 1)
          : -currentBetRef.current;

        const newStats = {
          roundsPlayed: prev.roundsPlayed + 1,
          wins: prev.wins + (won ? 1 : 0),
          losses: prev.losses + (won ? 0 : 1),
          profit: prev.profit + roundProfit,
        };

        if (checkStopConditions(newStats)) {
          setTimeout(stopAutobet, 0);
        }

        return newStats;
      });

      // Calculate and set next bet
      const nextBet = calculateNextBet(won);
      setCurrentBet(Math.max(1, Math.round(nextBet * 100) / 100));
    }

    // Place bet when waiting phase is active and autobet is running
    if (phase === 'waiting' && runningRef.current) {
      const betAmount = currentBetRef.current || configRef.current.baseBet;
      if (betAmount <= balance) {
        const timer = setTimeout(() => {
          if (runningRef.current) {
            onPlaceBet(betAmount, configRef.current.autoCashOut);
          }
        }, 500);
        return () => clearTimeout(timer);
      } else {
        stopAutobet();
      }
    }
  }, [phase, isActive, balance, onPlaceBet, calculateNextBet, checkStopConditions, stopAutobet]);

  const handleToggle = () => {
    if (running) {
      stopAutobet();
    } else {
      resetStats();
      setCurrentBet(config.baseBet);
      setRunning(true);

      // Place first bet immediately if in waiting phase
      if (phase === 'waiting' && config.baseBet <= balance) {
        onPlaceBet(config.baseBet, config.autoCashOut);
      }
    }
  };

  const isCustom = config.strategy === 'custom';

  return (
    <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            running ? 'bg-accent/20' : 'bg-surface-light'
          }`}>
            <Bot className={`w-4 h-4 ${running ? 'text-accent' : 'text-gray-500'}`} />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Авто-ставка</h3>
            <p className="text-gray-500 text-[11px]">
              {running ? 'Работает' : 'Отключено'}
            </p>
          </div>
        </div>

        {/* Running indicator */}
        {running && (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex items-center gap-1.5"
          >
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-accent text-xs font-medium">ACTIVE</span>
          </motion.div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Base bet */}
        <div>
          <label className="text-gray-400 text-xs mb-1.5 block">Базовая ставка</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              value={config.baseBet}
              onChange={e => updateConfig({ baseBet: Math.max(1, parseFloat(e.target.value) || 1) })}
              disabled={running}
              className="w-full bg-bg border border-white/10 rounded-xl pl-7 pr-4 py-2.5 text-white text-sm
                focus:outline-none focus:border-accent/50 transition disabled:opacity-50 tabular-nums"
              min="1"
              step="1"
            />
          </div>
          <div className="flex gap-2 mt-2">
            {[5, 10, 25, 50, 100].map(q => (
              <button
                key={q}
                onClick={() => updateConfig({ baseBet: q })}
                disabled={running}
                className="flex-1 py-1.5 rounded-lg bg-surface-light text-gray-400 text-xs font-medium
                  hover:bg-white/10 hover:text-white transition disabled:opacity-30"
              >
                ${q}
              </button>
            ))}
          </div>
        </div>

        {/* Auto cash-out */}
        <div>
          <label className="text-gray-400 text-xs mb-1.5 block">Авто-вывод</label>
          <div className="relative">
            <input
              type="number"
              value={config.autoCashOut}
              onChange={e => updateConfig({ autoCashOut: Math.max(1.01, parseFloat(e.target.value) || 1.01) })}
              disabled={running}
              className="w-full bg-bg border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
                focus:outline-none focus:border-accent/50 transition disabled:opacity-50 tabular-nums"
              min="1.01"
              step="0.1"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">x</span>
          </div>
        </div>

        {/* Strategy selector */}
        <div>
          <label className="text-gray-400 text-xs mb-1.5 block">Стратегия</label>
          <div className="grid grid-cols-2 gap-2">
            {STRATEGIES.map(s => (
              <button
                key={s.key}
                onClick={() => updateConfig({ strategy: s.key })}
                disabled={running}
                className={`p-2.5 rounded-xl border text-left transition ${
                  config.strategy === s.key
                    ? 'bg-accent/10 border-accent/30 text-white'
                    : 'bg-surface-light border-white/5 text-gray-400 hover:border-white/10'
                } disabled:opacity-50`}
              >
                <div className="text-xs font-medium">{s.label}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{s.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom strategy options */}
        <AnimatePresence>
          {isCustom && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-3"
            >
              {/* On loss */}
              <div className="bg-bg rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-3.5 h-3.5 text-danger" />
                  <span className="text-xs text-gray-400">При проигрыше</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateConfig({ onLoss: 'reset' })}
                    disabled={running}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                      config.onLoss === 'reset'
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : 'bg-surface-light text-gray-400'
                    } disabled:opacity-50`}
                  >
                    Сбросить
                  </button>
                  <button
                    onClick={() => updateConfig({ onLoss: 'increase' })}
                    disabled={running}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                      config.onLoss === 'increase'
                        ? 'bg-danger/20 text-danger border border-danger/30'
                        : 'bg-surface-light text-gray-400'
                    } disabled:opacity-50`}
                  >
                    Увеличить
                  </button>
                </div>
                {config.onLoss === 'increase' && (
                  <div className="mt-2">
                    <input
                      type="number"
                      value={config.lossIncreasePercent}
                      onChange={e => updateConfig({ lossIncreasePercent: Math.max(1, parseFloat(e.target.value) || 1) })}
                      disabled={running}
                      className="w-full bg-surface-light border border-white/10 rounded-lg px-3 py-2 text-white text-xs
                        focus:outline-none focus:border-accent/50 transition disabled:opacity-50 tabular-nums"
                      min="1"
                    />
                    <span className="text-[10px] text-gray-500 mt-0.5 block">Увеличение (%)</span>
                  </div>
                )}
              </div>

              {/* On win */}
              <div className="bg-bg rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs text-gray-400">При выигрыше</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateConfig({ onWin: 'reset' })}
                    disabled={running}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                      config.onWin === 'reset'
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : 'bg-surface-light text-gray-400'
                    } disabled:opacity-50`}
                  >
                    Сбросить
                  </button>
                  <button
                    onClick={() => updateConfig({ onWin: 'increase' })}
                    disabled={running}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                      config.onWin === 'increase'
                        ? 'bg-accent/20 text-accent border border-accent/30'
                        : 'bg-surface-light text-gray-400'
                    } disabled:opacity-50`}
                  >
                    Увеличить
                  </button>
                </div>
                {config.onWin === 'increase' && (
                  <div className="mt-2">
                    <input
                      type="number"
                      value={config.winIncreasePercent}
                      onChange={e => updateConfig({ winIncreasePercent: Math.max(1, parseFloat(e.target.value) || 1) })}
                      disabled={running}
                      className="w-full bg-surface-light border border-white/10 rounded-lg px-3 py-2 text-white text-xs
                        focus:outline-none focus:border-accent/50 transition disabled:opacity-50 tabular-nums"
                      min="1"
                    />
                    <span className="text-[10px] text-gray-500 mt-0.5 block">Увеличение (%)</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Advanced settings toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition w-full"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Стоп-условия</span>
          {showAdvanced
            ? <ChevronUp className="w-3.5 h-3.5 ml-auto" />
            : <ChevronDown className="w-3.5 h-3.5 ml-auto" />
          }
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-3"
            >
              {/* Number of rounds */}
              <div>
                <label className="text-gray-400 text-[11px] mb-1 block">Кол-во раундов (0 = бесконечно)</label>
                <input
                  type="number"
                  value={config.maxRounds}
                  onChange={e => updateConfig({ maxRounds: Math.max(0, parseInt(e.target.value) || 0) })}
                  disabled={running}
                  className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-white text-xs
                    focus:outline-none focus:border-accent/50 transition disabled:opacity-50 tabular-nums"
                  min="0"
                />
              </div>

              {/* Stop on profit */}
              <div>
                <label className="text-gray-400 text-[11px] mb-1 block">Стоп при профите (0 = выкл)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                  <input
                    type="number"
                    value={config.stopOnProfit}
                    onChange={e => updateConfig({ stopOnProfit: Math.max(0, parseFloat(e.target.value) || 0) })}
                    disabled={running}
                    className="w-full bg-bg border border-white/10 rounded-lg pl-7 pr-3 py-2 text-white text-xs
                      focus:outline-none focus:border-accent/50 transition disabled:opacity-50 tabular-nums"
                    min="0"
                  />
                </div>
              </div>

              {/* Stop on loss */}
              <div>
                <label className="text-gray-400 text-[11px] mb-1 block">Стоп при убытке (0 = выкл)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                  <input
                    type="number"
                    value={config.stopOnLoss}
                    onChange={e => updateConfig({ stopOnLoss: Math.max(0, parseFloat(e.target.value) || 0) })}
                    disabled={running}
                    className="w-full bg-bg border border-white/10 rounded-lg pl-7 pr-3 py-2 text-white text-xs
                      focus:outline-none focus:border-accent/50 transition disabled:opacity-50 tabular-nums"
                    min="0"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session stats */}
        {(running || stats.roundsPlayed > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-bg rounded-xl p-3 border border-white/5"
          >
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-400">Статистика сессии</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <div className="text-white text-sm font-bold tabular-nums">{stats.roundsPlayed}</div>
                <div className="text-[10px] text-gray-500">Раундов</div>
              </div>
              <div className="text-center">
                <div className="text-accent text-sm font-bold tabular-nums">{stats.wins}</div>
                <div className="text-[10px] text-gray-500">Побед</div>
              </div>
              <div className="text-center">
                <div className="text-danger text-sm font-bold tabular-nums">{stats.losses}</div>
                <div className="text-[10px] text-gray-500">Поражений</div>
              </div>
              <div className="text-center">
                <div className={`text-sm font-bold tabular-nums ${
                  stats.profit >= 0 ? 'text-accent' : 'text-danger'
                }`}>
                  {stats.profit >= 0 ? '+' : ''}${stats.profit.toFixed(2)}
                </div>
                <div className="text-[10px] text-gray-500">Профит</div>
              </div>
            </div>

            {/* Current bet indicator */}
            {running && (
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">Текущая ставка:</span>
                <span className="text-xs text-white font-medium tabular-nums">${currentBet.toFixed(2)}</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Balance warning */}
        {config.baseBet > balance && !running && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
            <span className="text-warning text-xs">Недостаточно средств</span>
          </div>
        )}

        {/* Start/Stop button */}
        <motion.button
          onClick={handleToggle}
          disabled={!running && (config.baseBet > balance || config.baseBet < 1 || config.autoCashOut < 1.01)}
          whileTap={{ scale: 0.95 }}
          className={`w-full py-3.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
            running
              ? 'bg-danger text-white hover:bg-red-600'
              : 'bg-accent text-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          {running ? (
            <>
              <Square className="w-4 h-4" />
              Остановить
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Запустить авто-ставку
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
