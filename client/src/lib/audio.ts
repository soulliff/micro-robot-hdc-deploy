/**
 * audio.ts — Synthesized sound effects via Web Audio API
 *
 * No external audio files needed — all sounds generated programmatically.
 * Supports spatial stereo panning for positional audio.
 */

let ctx: AudioContext | null = null;
let muted = false;
let volume = 0.3;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/**
 * Core beep with optional stereo pan.
 * Chain: oscillator → gain → panner → destination
 */
function beep(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  vol = volume,
  pan = 0,
): void {
  if (muted) return;
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    const panner = c.createStereoPanner();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), c.currentTime);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch {
    // Audio context may not be available
  }
}

// ---------------------------------------------------------------------------
// Spatial audio wrapper
// ---------------------------------------------------------------------------

/**
 * Convert world X position to stereo pan and invoke a sound function.
 * pan = (worldX / mapWidth) * 2 - 1  →  [-1, +1]
 */
export function playAtPosition(
  soundFn: (pan?: number) => void,
  worldX: number,
  _worldY: number,
  mapWidth: number,
): void {
  const pan = Math.max(-1, Math.min(1, (worldX / mapWidth) * 2 - 1));
  soundFn(pan);
}

// ---------------------------------------------------------------------------
// Existing sound effects (preserved API, added optional pan)
// ---------------------------------------------------------------------------

/** Rising tone — deployment */
export function playDeploy(pan = 0): void {
  beep(300, 0.15, 'sine', volume, pan);
  setTimeout(() => beep(400, 0.15, 'sine', volume, pan), 100);
  setTimeout(() => beep(600, 0.2, 'sine', volume, pan), 200);
}

/** Falling tone — recall */
export function playRecall(pan = 0): void {
  beep(600, 0.15, 'sine', volume, pan);
  setTimeout(() => beep(400, 0.15, 'sine', volume, pan), 100);
  setTimeout(() => beep(300, 0.2, 'sine', volume, pan), 200);
}

/** Short ding — detection */
export function playDetect(pan = 0): void {
  beep(800, 0.1, 'triangle', volume, pan);
}

/** Double ding — classification confirmed */
export function playClassify(pan = 0): void {
  beep(1000, 0.08, 'triangle', volume, pan);
  setTimeout(() => beep(1200, 0.12, 'triangle', volume, pan), 80);
}

/** Alert buzz — warning */
export function playAlert(pan = 0): void {
  beep(200, 0.3, 'sawtooth', 0.15, pan);
}

/** Whoosh — wind gust */
export function playGust(pan = 0): void {
  if (muted) return;
  try {
    const c = getCtx();
    const bufferSize = c.sampleRate * 0.4;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, c.currentTime);
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume * 0.5, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    const panner = c.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), c.currentTime);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(c.destination);
    source.start();
  } catch {
    // ignore
  }
}

/** Mission start fanfare */
export function playMissionStart(pan = 0): void {
  beep(400, 0.1, 'square', 0.2, pan);
  setTimeout(() => beep(500, 0.1, 'square', 0.2, pan), 100);
  setTimeout(() => beep(600, 0.1, 'square', 0.2, pan), 200);
  setTimeout(() => beep(800, 0.2, 'square', 0.2, pan), 300);
}

// ---------------------------------------------------------------------------
// New sound effects
// ---------------------------------------------------------------------------

/** Rising major chord (C-E-G), triangle wave, 0.3s */
export function playClassifySuccess(pan = 0): void {
  // C4=261.63, E4=329.63, G4=392.00
  beep(261.63, 0.3, 'triangle', volume, pan);
  setTimeout(() => beep(329.63, 0.25, 'triangle', volume, pan), 60);
  setTimeout(() => beep(392.0, 0.2, 'triangle', volume, pan), 120);
}

/** Descending minor tone, sawtooth, 0.2s */
export function playClassifyFail(pan = 0): void {
  // Eb4=311.13 → C4=261.63
  beep(311.13, 0.2, 'sawtooth', volume * 0.6, pan);
  setTimeout(() => beep(261.63, 0.15, 'sawtooth', volume * 0.5, pan), 80);
}

/**
 * Mission complete — varies by score.
 * High (>300): 4-note ascending major (C-E-G-C5), square, 0.6s
 * Low (<100):  2-note descending (C-G3), sine, 0.4s
 * Medium:      3-note neutral arpeggio
 */
export function playMissionComplete(score: number, pan = 0): void {
  if (score > 300) {
    // Victory fanfare — C4 E4 G4 C5
    beep(261.63, 0.15, 'square', 0.2, pan);
    setTimeout(() => beep(329.63, 0.15, 'square', 0.2, pan), 150);
    setTimeout(() => beep(392.0, 0.15, 'square', 0.2, pan), 300);
    setTimeout(() => beep(523.25, 0.25, 'square', 0.25, pan), 450);
  } else if (score < 100) {
    // Low drum — C4 descending to G3
    beep(261.63, 0.2, 'sine', 0.2, pan);
    setTimeout(() => beep(196.0, 0.25, 'sine', 0.15, pan), 200);
  } else {
    // 3-note neutral arpeggio — C4 F4 A4
    beep(261.63, 0.15, 'triangle', 0.2, pan);
    setTimeout(() => beep(349.23, 0.15, 'triangle', 0.2, pan), 130);
    setTimeout(() => beep(440.0, 0.2, 'triangle', 0.2, pan), 260);
  }
}

/** Ambient wind loop — returns { stop } handle for continuous filtered noise. */
export function playAmbientWind(windClass: string): { stop: () => void } {
  const noop = { stop: () => {} };
  if (muted) return noop;

  // Map wind class to gain / cutoff
  type WindParams = { gain: number; cutoff: number };
  const windMap: Record<string, WindParams> = {
    CALM: { gain: 0.02, cutoff: 200 },
    LIGHT: { gain: 0.04, cutoff: 300 },
    MODERATE: { gain: 0.08, cutoff: 500 },
    STRONG: { gain: 0.15, cutoff: 800 },
  };
  const params = windMap[windClass] ?? windMap['CALM']!;

  try {
    const c = getCtx();
    // Create 2-second noise buffer and loop it
    const sampleLen = c.sampleRate * 2;
    const buffer = c.createBuffer(1, sampleLen, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleLen; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(params.cutoff, c.currentTime);

    const gain = c.createGain();
    gain.gain.setValueAtTime(params.gain, c.currentTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    source.start();

    return {
      stop: () => {
        try {
          gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
          setTimeout(() => {
            try { source.stop(); } catch { /* already stopped */ }
          }, 350);
        } catch {
          // ignore
        }
      },
    };
  } catch {
    return noop;
  }
}

/** Short burst of white noise through a highpass filter, 0.05s */
export function playCollision(pan = 0): void {
  if (muted) return;
  try {
    const c = getCtx();
    const bufferSize = Math.floor(c.sampleRate * 0.05);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2000, c.currentTime);

    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);

    const panner = c.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), c.currentTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(c.destination);
    source.start();
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/** Toggle mute */
export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

/** Set volume 0-1 */
export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
}

export function isMuted(): boolean {
  return muted;
}
