import { useMemo, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GamePhase } from '@/types';
import { RocketSVG, type RocketSkinId } from './RocketSkins';
import { CHART_PADDING } from './CrashChart';

interface Props {
  phase: GamePhase;
  multiplier: number;
  elapsed: number;
  crashPoint: number | null;
  rocketSkin?: RocketSkinId;
}

/* ---------- rocket position synced with CrashChart ---------- */
function getRocketXY(
  elapsed: number,
  multiplier: number,
  containerW: number,
  containerH: number,
): { x: number; y: number } {
  const pad = CHART_PADDING;
  const plotW = containerW - pad.left - pad.right;
  const plotH = containerH - pad.top - pad.bottom;

  const maxTime = Math.max(elapsed, 3000);
  const maxMult = Math.max(multiplier, 2);

  const x = pad.left + (elapsed / maxTime) * plotW;
  const y = pad.top + plotH - ((multiplier - 1) / (maxMult - 1)) * plotH;

  // Convert to percentages of container
  return {
    x: (x / containerW) * 100,
    y: (y / containerH) * 100,
  };
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
export default function RocketAnimation({ phase, multiplier, elapsed, rocketSkin = 'classic' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Track container size to compute correct pixel-based position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ w: rect.width, h: rect.height });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isRunning = phase === 'running';
  const isCrashed = phase === 'crashed';
  const isWaiting = phase === 'waiting';

  let posX: number, posY: number, rotation: number;

  if (isWaiting || containerSize.w === 0) {
    // Bottom-left start position (matches chart origin)
    const pad = CHART_PADDING;
    posX = containerSize.w > 0 ? (pad.left / containerSize.w) * 100 : 5;
    posY = containerSize.h > 0 ? ((containerSize.h - pad.bottom) / containerSize.h) * 100 : 85;
    rotation = 45;
  } else {
    const pos = getRocketXY(elapsed, multiplier, containerSize.w, containerSize.h);
    posX = pos.x;
    posY = pos.y;
    const steepness = Math.log(multiplier) / Math.log(50);
    rotation = 55 - Math.min(50, steepness * 55);
  }

  const explosionParticles = useExplosionParticles(isCrashed);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
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
                <motion.div
                  className="absolute -translate-x-1/2 rounded-full"
                  style={{
                    width: 12,
                    left: '50%',
                    background: 'linear-gradient(to bottom, #ff9800, #ff5722, transparent)',
                  }}
                  animate={{ height: [20, 35, 20], opacity: [1, 0.8, 1] }}
                  transition={{ duration: 0.15, repeat: Infinity }}
                />
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 6, left: -4, background: 'linear-gradient(to bottom, #ffcc02, transparent)' }}
                  animate={{ height: [10, 20, 10], opacity: [0.8, 0.5, 0.8] }}
                  transition={{ duration: 0.12, repeat: Infinity }}
                />
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 6, right: -4, background: 'linear-gradient(to bottom, #ffcc02, transparent)' }}
                  animate={{ height: [10, 20, 10], opacity: [0.8, 0.5, 0.8] }}
                  transition={{ duration: 0.12, repeat: Infinity, delay: 0.06 }}
                />
              </div>
            )}

            <RocketSVG skin={rocketSkin} />

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
            <motion.div
              className="absolute rounded-full border-2 border-orange-400/60"
              style={{ left: `${posX}%`, top: `${posY}%`, transform: 'translate(-50%, -50%)' }}
              initial={{ width: 0, height: 0, opacity: 1 }}
              animate={{ width: 160, height: 160, opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full bg-orange-400"
              style={{ left: `${posX}%`, top: `${posY}%`, transform: 'translate(-50%, -50%)' }}
              initial={{ width: 24, height: 24, opacity: 0.9 }}
              animate={{ width: 60, height: 60, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
            {explosionParticles.map((p) => (
              <motion.div
                key={`exp-${p.id}`}
                className="absolute rounded-full"
                style={{
                  left: `${posX}%`, top: `${posY}%`,
                  width: p.size, height: p.size,
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
