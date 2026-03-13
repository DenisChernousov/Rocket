import { useEffect, useRef } from 'react';
import type { GamePhase } from '@/types';

interface Props {
  phase: GamePhase;
  multiplier: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

const STAR_COUNT = 120;
const BASE_SPEED = 0.15;

function createStars(width: number, height: number): Star[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: 0.5 + Math.random() * 1.8,
    speed: 0.3 + Math.random() * 0.7,
    opacity: 0.3 + Math.random() * 0.5,
  }));
}

export default function Starfield({ phase, multiplier }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const phaseRef = useRef(phase);
  const multiplierRef = useRef(multiplier);
  const rafRef = useRef<number>(0);

  phaseRef.current = phase;
  multiplierRef.current = multiplier;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width;
      canvas.height = rect.height;

      if (starsRef.current.length === 0) {
        starsRef.current = createStars(canvas.width, canvas.height);
      }
    };
    resize();

    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const currentPhase = phaseRef.current;
      const currentMultiplier = multiplierRef.current;

      ctx.clearRect(0, 0, w, h);

      const speedFactor =
        currentPhase === 'running'
          ? 1 + Math.min(currentMultiplier, 30) * 0.3
          : currentPhase === 'crashed'
            ? 0
            : 1;

      // During high speed, draw stars as short streaks
      const streak = currentPhase === 'running' && currentMultiplier > 2;

      for (const star of starsRef.current) {
        // Move star downward
        star.y += star.speed * BASE_SPEED * speedFactor * 3;

        // Wrap around
        if (star.y > h + 4) {
          star.y = -2;
          star.x = Math.random() * w;
        }

        // Draw
        ctx.globalAlpha = star.opacity * (currentPhase === 'crashed' ? 0.3 : 1);

        if (streak) {
          const streakLen = Math.min(star.speed * speedFactor * 3, 12);
          const gradient = ctx.createLinearGradient(
            star.x,
            star.y - streakLen,
            star.x,
            star.y,
          );
          gradient.addColorStop(0, 'rgba(255,255,255,0)');
          gradient.addColorStop(1, 'rgba(255,255,255,1)');
          ctx.strokeStyle = gradient;
          ctx.lineWidth = star.size * 0.7;
          ctx.beginPath();
          ctx.moveTo(star.x, star.y - streakLen);
          ctx.lineTo(star.x, star.y);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: 0.6 }}
    />
  );
}
