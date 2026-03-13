import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GamePhase } from '@/types';

interface Props {
  phase: GamePhase;
  multiplier: number;
  elapsed: number;
  crashPoint: number | null;
  countdown: number;
}

export function CrashChart({ phase, multiplier, elapsed, crashPoint, countdown }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);

  // Collect points during running phase
  useEffect(() => {
    if (phase === 'running') {
      pointsRef.current.push({ x: elapsed, y: multiplier });
      // Keep max 2000 points
      if (pointsRef.current.length > 2000) {
        pointsRef.current = pointsRef.current.filter((_, i) => i % 2 === 0);
      }
    } else if (phase === 'waiting') {
      pointsRef.current = [];
    }
  }, [phase, elapsed, multiplier]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = h - (i / 5) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const points = pointsRef.current;
    if (points.length < 2) return;

    const maxTime = Math.max(points[points.length - 1].x, 3000);
    const maxMult = Math.max(multiplier, 2);

    const padding = { top: 20, bottom: 40, left: 10, right: 10 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const toX = (time: number) => padding.left + (time / maxTime) * plotW;
    const toY = (mult: number) => padding.top + plotH - ((mult - 1) / (maxMult - 1)) * plotH;

    // Draw line
    const crashed = phase === 'crashed';
    const gradient = ctx.createLinearGradient(0, h, 0, 0);
    if (crashed) {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.0)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
    } else {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.0)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.3)');
    }

    // Fill under curve
    ctx.beginPath();
    ctx.moveTo(toX(points[0].x), toY(points[0].y));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(toX(points[i].x), toY(points[i].y));
    }
    ctx.lineTo(toX(points[points.length - 1].x), h - padding.bottom);
    ctx.lineTo(toX(points[0].x), h - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke curve
    ctx.beginPath();
    ctx.moveTo(toX(points[0].x), toY(points[0].y));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(toX(points[i].x), toY(points[i].y));
    }
    ctx.strokeStyle = crashed ? '#ef4444' : '#10b981';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dot at end
    if (!crashed) {
      const lastP = points[points.length - 1];
      const dotX = toX(lastP.x);
      const dotY = toY(lastP.y);

      ctx.beginPath();
      ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(dotX, dotY, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.fill();
    }
  }, [phase, multiplier, elapsed]);

  const displayMultiplier = phase === 'crashed' ? (crashPoint || multiplier) : multiplier;
  const isRunning = phase === 'running';
  const isCrashed = phase === 'crashed';
  const isWaiting = phase === 'waiting';

  return (
    <div className="relative w-full aspect-[16/9] max-h-[400px] bg-surface rounded-2xl overflow-hidden border border-white/5">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Center overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isWaiting && (
            <motion.div
              key="waiting"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-center"
            >
              <div className="text-gray-400 text-sm mb-2">Следующий раунд через</div>
              <div className="text-4xl font-bold text-white tabular-nums">
                {Math.max(0, Math.ceil(countdown / 1000))}с
              </div>
            </motion.div>
          )}

          {isRunning && (
            <motion.div
              key="running"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center crash-glow"
            >
              <motion.div
                className="text-6xl sm:text-7xl font-black text-accent tabular-nums"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 0.3, repeat: Infinity }}
              >
                {displayMultiplier.toFixed(2)}x
              </motion.div>
            </motion.div>
          )}

          {isCrashed && (
            <motion.div
              key="crashed"
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15 }}
              className="text-center crash-glow-red"
            >
              <div className="text-6xl sm:text-7xl font-black text-danger tabular-nums">
                {displayMultiplier.toFixed(2)}x
              </div>
              <div className="text-danger/60 text-lg mt-1 font-medium">CRASHED</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
