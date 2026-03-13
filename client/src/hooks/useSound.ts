import { useCallback, useRef, useState } from 'react';

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioContext();
  }
  return sharedCtx;
}

function ensureResumed(ctx: AudioContext): void {
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
}

export function useSound() {
  const [muted, setMuted] = useState(true);
  const mutedRef = useRef(true);
  const interactedRef = useRef(false);

  const toggleMute = useCallback(() => {
    // First toggle counts as user interaction, enabling audio
    if (!interactedRef.current) {
      interactedRef.current = true;
      getAudioContext();
    }
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  }, []);

  const canPlay = useCallback((): AudioContext | null => {
    if (mutedRef.current) return null;
    if (!interactedRef.current) return null;
    const ctx = getAudioContext();
    ensureResumed(ctx);
    return ctx;
  }, []);

  // Short high-pitched beep; pitch increases with multiplier
  const playTick = useCallback(
    (multiplier = 1) => {
      const ctx = canPlay();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = 600 + Math.min(multiplier, 20) * 80;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.06);
    },
    [canPlay],
  );

  // Click / pop sound
  const playBet = useCallback(() => {
    const ctx = canPlay();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }, [canPlay]);

  // Cash register "cha-ching"
  const playCashOut = useCallback(() => {
    const ctx = canPlay();
    if (!ctx) return;

    // High metallic "cha"
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(3000, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.06);
    gain1.gain.setValueAtTime(0.1, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.07);

    // "ching" — bell-like ring
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(4200, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.36);

    // Harmonic overtone for bell shimmer
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.value = 6300;
    gain3.gain.setValueAtTime(0, ctx.currentTime);
    gain3.gain.setValueAtTime(0.06, ctx.currentTime + 0.08);
    gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc3.connect(gain3).connect(ctx.destination);
    osc3.start(ctx.currentTime + 0.08);
    osc3.stop(ctx.currentTime + 0.31);
  }, [canPlay]);

  // Explosion-like noise burst: white noise + low frequency rumble
  const playCrash = useCallback(() => {
    const ctx = canPlay();
    if (!ctx) return;

    const duration = 0.6;

    // White noise via buffer
    const bufferSize = ctx.sampleRate * duration;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    // Low-pass filter for rumble character
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + duration);

    noiseSrc.connect(filter).connect(noiseGain).connect(ctx.destination);
    noiseSrc.start(ctx.currentTime);
    noiseSrc.stop(ctx.currentTime + duration);

    // Low frequency thump
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.4);
    oscGain.gain.setValueAtTime(0.4, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.41);
  }, [canPlay]);

  // Pleasant ascending arpeggio (C-E-G-C)
  const playWin = useCallback(() => {
    const ctx = canPlay();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const noteLen = 0.12;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const start = ctx.currentTime + i * noteLen;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
      gain.gain.setValueAtTime(0.15, start + noteLen - 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteLen + 0.1);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + noteLen + 0.11);
    });
  }, [canPlay]);

  // 3 short countdown beeps
  const playCountdown = useCallback(
    (secondsLeft: number) => {
      const ctx = canPlay();
      if (!ctx) return;
      if (secondsLeft < 1 || secondsLeft > 3) return;

      const freq = secondsLeft === 1 ? 880 : 660;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.16);
    },
    [canPlay],
  );

  return {
    playTick,
    playBet,
    playCashOut,
    playCrash,
    playWin,
    playCountdown,
    muted,
    toggleMute,
  } as const;
}
