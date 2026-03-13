import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GamePhase } from '@/types';

interface Props {
  phase: GamePhase;
  multiplier: number;
  elapsed: number;
  crashPoint: number | null;
}

/* ---------- rocket position (synced with CrashChart) ---------- */
function getChartXY(elapsed: number, multiplier: number) {
  const maxTime = Math.max(elapsed, 3000);
  const maxMult = Math.max(multiplier, 2);

  const padL = 2.5;
  const padT = 5;
  const plotW = 95;
  const plotH = 80;

  const x = padL + (elapsed / maxTime) * plotW;
  const y = padT + plotH - ((multiplier - 1) / (maxMult - 1)) * plotH;
  return { x, y };
}

/* ---------- explosion debris ---------- */
function useExplosionParticles(crashed: boolean) {
  return useMemo(() => {
    if (!crashed) return [];
    const colors = ['#ff5722', '#ff9800', '#ffcc02', '#ff7043', '#fff'];
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      angle: (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
      distance: 30 + Math.random() * 70,
      size: 3 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 0.4 + Math.random() * 0.5,
    }));
  }, [crashed]);
}

/* ---------- main component ---------- */
export default function RocketAnimation({ phase, multiplier, elapsed }: Props) {
  const isRunning = phase === 'running';
  const isCrashed = phase === 'crashed';
  const isWaiting = phase === 'waiting';

  let posX: number, posY: number, rotation: number;

  if (isWaiting) {
    posX = 5;
    posY = 82;
    rotation = 0; // nose straight up on launchpad
  } else {
    const cur = getChartXY(elapsed, multiplier);
    posX = cur.x;
    posY = cur.y;

    // Angle based on curve steepness:
    // mult ~1.0 → flat trajectory → tilted 55° right
    // mult grows → steeper → tilts back toward vertical
    // Uses log so the transition is smooth and natural
    const steepness = Math.log(multiplier) / Math.log(50); // 0..1 range (1x..50x)
    rotation = 55 - Math.min(50, steepness * 55); // 55° → ~5°
  }

  const explosionParticles = useExplosionParticles(isCrashed);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Rocket */}
      <AnimatePresence>
        {!isCrashed && (
          <motion.div
            className="absolute z-10"
            style={{
              left: `${posX}%`,
              top: `${posY}%`,
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            }}
            transition={{ type: 'tween', duration: 0.1 }}
            exit={{ opacity: 0, scale: 0, transition: { duration: 0.15 } }}
          >
            {/* Flame trail */}
            {isRunning && (
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: '100%' }}>
                {/* Main flame */}
                <motion.div
                  className="absolute -translate-x-1/2 rounded-full"
                  style={{
                    width: 12,
                    left: '50%',
                    background: 'linear-gradient(to bottom, #ff9800, #ff5722, transparent)',
                  }}
                  animate={{
                    height: [20, 35, 20],
                    opacity: [1, 0.8, 1],
                  }}
                  transition={{ duration: 0.15, repeat: Infinity }}
                />
                {/* Side flames */}
                <motion.div
                  className="absolute rounded-full"
                  style={{
                    width: 6,
                    left: -4,
                    background: 'linear-gradient(to bottom, #ffcc02, transparent)',
                  }}
                  animate={{
                    height: [10, 20, 10],
                    opacity: [0.8, 0.5, 0.8],
                  }}
                  transition={{ duration: 0.12, repeat: Infinity }}
                />
                <motion.div
                  className="absolute rounded-full"
                  style={{
                    width: 6,
                    right: -4,
                    background: 'linear-gradient(to bottom, #ffcc02, transparent)',
                  }}
                  animate={{
                    height: [10, 20, 10],
                    opacity: [0.8, 0.5, 0.8],
                  }}
                  transition={{ duration: 0.12, repeat: Infinity, delay: 0.06 }}
                />
              </div>
            )}

            {/* Rocket SVG — bigger */}
            <svg
              width="48"
              height="64"
              viewBox="0 0 40 56"
              fill="none"
              style={{ filter: 'drop-shadow(0 0 12px rgba(255,160,0,0.5))' }}
            >
              <path d="M20 0 L28 18 H12 Z" fill="#e0e0e0" stroke="#999" strokeWidth="0.5" />
              <rect x="12" y="18" width="16" height="24" rx="2" fill="#d0d0d0" stroke="#999" strokeWidth="0.5" />
              <circle cx="20" cy="28" r="4" fill="#4fc3f7" stroke="#0288d1" strokeWidth="0.8" />
              <path d="M12 36 L4 48 L12 42 Z" fill="#ef5350" stroke="#c62828" strokeWidth="0.5" />
              <path d="M28 36 L36 48 L28 42 Z" fill="#ef5350" stroke="#c62828" strokeWidth="0.5" />
              <path d="M14 42 L16 50 H24 L26 42 Z" fill="#757575" />
            </svg>

            {/* Glow behind rocket during flight */}
            {isRunning && (
              <div
                className="absolute inset-0 -z-10 rounded-full blur-xl"
                style={{
                  background: 'radial-gradient(circle, rgba(16,185,129,0.3), transparent 70%)',
                  transform: 'scale(2.5)',
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explosion on crash */}
      <AnimatePresence>
        {isCrashed && (
          <>
            {/* Shockwave */}
            <motion.div
              className="absolute rounded-full border-2 border-orange-400/60"
              style={{
                left: `${posX}%`,
                top: `${posY}%`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ width: 0, height: 0, opacity: 1 }}
              animate={{ width: 160, height: 160, opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />

            {/* Flash */}
            <motion.div
              className="absolute rounded-full bg-orange-400"
              style={{
                left: `${posX}%`,
                top: `${posY}%`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ width: 24, height: 24, opacity: 0.9 }}
              animate={{ width: 60, height: 60, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />

            {/* Debris */}
            {explosionParticles.map((p) => (
              <motion.div
                key={`exp-${p.id}`}
                className="absolute rounded-full"
                style={{
                  left: `${posX}%`,
                  top: `${posY}%`,
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{
                  x: Math.cos(p.angle) * p.distance,
                  y: Math.sin(p.angle) * p.distance,
                  opacity: 0,
                }}
                transition={{ duration: p.duration, ease: 'easeOut' }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
