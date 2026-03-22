import { useRef, useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GamePhase } from '@/types';

export const CHART_PADDING = { top: 20, bottom: 40, left: 45, right: 10 } as const;

// Module-level storage — survives component unmount (tab navigation)
let _points: { x: number; y: number }[] = [];

interface Props {
  phase: GamePhase;
  multiplier: number;
  elapsed: number;
  crashPoint: number | null;
  countdown: number;
  children?: ReactNode;
}

function getMultColor(mult: number): { line: string; fill: string; class: string } {
  if (mult < 2) return { line: '#10b981', fill: 'rgba(16,185,129,', class: 'mult-low' };
  if (mult < 5) return { line: '#f59e0b', fill: 'rgba(245,158,11,', class: 'mult-mid' };
  if (mult < 10) return { line: '#ef4444', fill: 'rgba(239,68,68,', class: 'mult-high' };
  if (mult < 50) return { line: '#8b5cf6', fill: 'rgba(139,92,246,', class: 'mult-epic' };
  return { line: '#fbbf24', fill: 'rgba(251,191,36,', class: 'mult-legendary' };
}

export function CrashChart({ phase, multiplier, elapsed, crashPoint, countdown, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // pointsRef points to the module-level array — survives tab navigation
  const pointsRef = useRef<{ x: number; y: number }[]>(_points);
  const phaseRef = useRef(phase);
  const multiplierRef = useRef(multiplier);
  phaseRef.current = phase;
  multiplierRef.current = multiplier;

  // Collect points during running phase
  useEffect(() => {
    if (phase === 'running') {
      _points.push({ x: elapsed, y: multiplier });
      if (_points.length > 2000) {
        _points = _points.filter((_, i) => i % 2 === 0);
      }
      pointsRef.current = _points;
    } else if (phase === 'waiting') {
      _points = [];
      pointsRef.current = [];
    }
  }, [phase, elapsed, multiplier]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const phase = phaseRef.current;
    const multiplier = multiplierRef.current;
    ctx.clearRect(0, 0, w, h);

    // Grid with axis labels
    const padding = CHART_PADDING;
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const maxMult = Math.max(multiplier, 2);

    // Horizontal grid lines with multiplier labels
    for (let i = 1; i <= 4; i++) {
      const y = padding.top + plotH - (i / 4) * plotH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      const labelMult = 1 + (i / 4) * (maxMult - 1);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '10px Inter, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`${labelMult.toFixed(1)}x`, padding.left - 6, y + 3);
    }

    // Vertical grid lines with time labels
    const points = pointsRef.current;
    const maxTime = points.length > 0 ? Math.max(points[points.length - 1].x, 3000) : 3000;
    for (let i = 1; i <= 4; i++) {
      const x = padding.left + (i / 4) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();

      const timeSec = ((i / 4) * maxTime / 1000).toFixed(0);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.textAlign = 'center';
      ctx.fillText(`${timeSec}s`, x, padding.top + plotH + 16);
    }

    if (points.length < 2) return;

    const toX = (time: number) => padding.left + (time / maxTime) * plotW;
    const toY = (mult: number) => padding.top + plotH - ((mult - 1) / (maxMult - 1)) * plotH;

    const crashed = phase === 'crashed';
    const multColor = crashed
      ? { line: '#ef4444', fill: 'rgba(239,68,68,' }
      : getMultColor(multiplier);

    // Fill under curve with gradient
    const gradient = ctx.createLinearGradient(0, h, 0, 0);
    gradient.addColorStop(0, multColor.fill + '0.0)');
    gradient.addColorStop(0.5, multColor.fill + '0.1)');
    gradient.addColorStop(1, multColor.fill + '0.35)');

    ctx.beginPath();
    ctx.moveTo(toX(points[0].x), toY(points[0].y));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(toX(points[i].x), toY(points[i].y));
    }
    ctx.lineTo(toX(points[points.length - 1].x), padding.top + plotH);
    ctx.lineTo(toX(points[0].x), padding.top + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke curve with glow
    ctx.shadowColor = multColor.line;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(toX(points[0].x), toY(points[0].y));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(toX(points[i].x), toY(points[i].y));
    }
    ctx.strokeStyle = multColor.line;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Animated dot at end
    if (!crashed) {
      const lastP = points[points.length - 1];
      const dotX = toX(lastP.x);
      const dotY = toY(lastP.y);

      // Outer glow
      const glowGrad = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 20);
      glowGrad.addColorStop(0, multColor.fill + '0.4)');
      glowGrad.addColorStop(1, multColor.fill + '0.0)');
      ctx.beginPath();
      ctx.arc(dotX, dotY, 20, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // Inner dot
      ctx.beginPath();
      ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
      ctx.fillStyle = multColor.line;
      ctx.fill();

      // White center
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }, []);

  // Draw on every data update
  useEffect(() => { draw(); }, [phase, multiplier, elapsed, draw]);

  // ResizeObserver — перерисовываем при изменении размера контейнера
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => { draw(); });
    observer.observe(canvas);
    // Initial draw after layout
    requestAnimationFrame(() => { draw(); });
    return () => observer.disconnect();
  }, [draw]);

  const displayMultiplier = phase === 'crashed' ? (crashPoint || multiplier) : multiplier;
  const isRunning = phase === 'running';
  const isCrashed = phase === 'crashed';
  const isWaiting = phase === 'waiting';
  const multColorClass = isCrashed ? '' : getMultColor(displayMultiplier).class;

  return (
    <div className="relative w-full aspect-[16/9] max-h-[400px] bg-surface rounded-2xl overflow-hidden chart-border">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {children}

      {/* Center overlay — z-20 чтобы быть выше ракеты (z-10) */}
      <div className="absolute inset-0 flex items-center justify-center z-20">
        <AnimatePresence mode="wait">
          {isWaiting && (
            <motion.div
              key="waiting"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-center"
            >
              <div className="text-gray-500 text-xs uppercase tracking-widest mb-2">Следующий раунд</div>
              <motion.div
                className="text-5xl font-black text-white tabular-nums"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {Math.max(0, Math.ceil(countdown / 1000))}
              </motion.div>
              <div className="text-gray-500 text-xs mt-1">секунд</div>
            </motion.div>
          )}

          {isRunning && (
            <motion.div
              key="running"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <motion.div
                className={`text-6xl sm:text-8xl font-black tabular-nums ${multColorClass}`}
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
              className="text-center"
            >
              <motion.div
                className="text-6xl sm:text-8xl font-black text-danger tabular-nums"
                style={{ textShadow: '0 0 40px rgba(239,68,68,0.6)' }}
                animate={{ opacity: [1, 0.7, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                {displayMultiplier.toFixed(2)}x
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-danger/70 text-sm mt-2 font-bold uppercase tracking-[0.3em]"
              >
                CRASHED
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
