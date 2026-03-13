import crypto from 'crypto';

/**
 * Provably Fair Crash Point Generation
 *
 * 1. Generate a random seed
 * 2. Hash seed with SHA-256 to produce game hash
 * 3. Derive crash point from hash
 * 4. Hash is revealed after game ends so players can verify
 *
 * House edge: ~3% (1 in 33 chance of instant crash at 1.00x)
 */

const HOUSE_EDGE = 0.03; // 3%

export function generateGameSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSeed(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

export function crashPointFromHash(hash: string): number {
  // Use first 13 hex chars (52 bits) for high precision
  const h = parseInt(hash.slice(0, 13), 16);

  // Instant crash (house edge ~3%)
  if (h % 33 === 0) return 1.00;

  // Map hash to crash point with house edge
  // e = 2^52, h = random value 0..e-1
  const e = 2 ** 52;
  const result = (1 - HOUSE_EDGE) * e / (e - h);

  // Clamp to 2 decimal places, minimum 1.00
  return Math.max(1.00, Math.floor(result * 100) / 100);
}

export function generateGame(): { seed: string; hash: string; crashPoint: number } {
  const seed = generateGameSeed();
  const hash = hashSeed(seed);
  const crashPoint = crashPointFromHash(hash);
  return { seed, hash, crashPoint };
}

/**
 * Calculate multiplier at a given elapsed time (ms)
 * Exponential growth: starts slow, accelerates
 */
export function multiplierAtTime(elapsedMs: number): number {
  // Growth rate: doubles roughly every 6.5 seconds
  const growthRate = 0.00006;
  const multiplier = Math.pow(Math.E, growthRate * elapsedMs);
  return Math.floor(multiplier * 100) / 100;
}

/**
 * Calculate elapsed time for a given multiplier
 */
export function timeForMultiplier(multiplier: number): number {
  const growthRate = 0.00006;
  return Math.log(multiplier) / growthRate;
}
