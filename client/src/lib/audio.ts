/**
 * 8-bit chiptune audio engine using Web Audio API.
 * All sounds are generated procedurally — no audio files needed.
 */

// Note frequencies
const N: Record<string, number> = {
  C3:130.81, G3:196.00, A3:220.00, B3:246.94,
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00, B5:987.77,
  C6:1046.50, R:0,
};

// [freq, duration_in_seconds]
type Beat = [number, number];

// ── Melodies ─────────────────────────────────────────────────────────────────

// Landing: upbeat adventure theme, 120 BPM
const LANDING: Beat[] = [
  [N.C5,.25],[N.E5,.25],[N.G5,.25],[N.E5,.25],
  [N.C5,.5], [N.R,.25], [N.G4,.25],
  [N.D5,.25],[N.F5,.25],[N.A5,.25],[N.F5,.25],
  [N.D5,.5], [N.R,.25], [N.A4,.25],
  [N.E5,.25],[N.G5,.25],[N.B5,.25],[N.G5,.25],
  [N.E5,.5], [N.R,.25], [N.B4,.25],
  [N.C5,.25],[N.E5,.25],[N.G5,.25],[N.C6,.25],
  [N.C5,.75],[N.R,.25],
];

// Landing bass line (lower octave, plays alongside melody)
const LANDING_BASS: Beat[] = [
  [N.C3,.5],[N.G3,.5],
  [N.C3,.5],[N.G3,.5],
  [N.D4,.5],[N.A3,.5],
  [N.D4,.5],[N.A3,.5],
  [N.E4,.5],[N.B3,.5],
  [N.E4,.5],[N.B3,.5],
  [N.C4,.5],[N.G3,.5],
  [N.C4,1.0],
];

// Battle: fast intense arcade theme, 160 BPM
const BATTLE: Beat[] = [
  [N.A4,.125],[N.A4,.125],[N.R,.125],[N.A4,.125],[N.R,.125],[N.F4,.125],[N.A4,.25],
  [N.E5,.375],[N.R,.125],[N.D5,.125],[N.C5,.125],
  [N.B4,.125],[N.B4,.125],[N.R,.125],[N.B4,.125],[N.R,.125],[N.G4,.125],[N.B4,.25],
  [N.F5,.375],[N.R,.375],
  [N.C5,.25],[N.D5,.25],[N.E5,.25],[N.C5,.25],
  [N.A4,.5],[N.R,.25],[N.A4,.25],
  [N.G4,.25],[N.A4,.25],[N.B4,.25],[N.C5,.25],
  [N.G5,.5],[N.R,.5],
];

const BATTLE_BASS: Beat[] = [
  [N.A3,.5],[N.A3,.5],
  [N.E4,.5],[N.E4,.5],
  [N.B3,.5],[N.B3,.5],
  [N.F4,.5],[N.R,.5],
  [N.C4,.5],[N.C4,.5],
  [N.A3,.5],[N.A3,.5],
  [N.G3,.5],[N.G3,.5],
  [N.G4,.5],[N.R,.5],
];

// ── Engine ────────────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let currentTrack: 'landing' | 'battle' | null = null;
let _muted = localStorage.getItem('arena_muted') === 'true';

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = _muted ? 0 : 0.18;
    musicGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = _muted ? 0 : 0.35;
    sfxGain.connect(masterGain);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function scheduleNote(
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
  target: GainNode,
  type: OscillatorType = 'square',
): void {
  if (!ctx || freq === 0) return;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.linearRampToValueAtTime(0, startTime + duration * 0.88);
  osc.connect(gain);
  gain.connect(target);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function scheduleMelody(beats: Beat[], startTime: number, volume: number, type: OscillatorType = 'square'): number {
  const c = getCtx();
  const g = musicGain!;
  let t = startTime;
  beats.forEach(([freq, dur]) => {
    scheduleNote(freq, t, dur, volume, g, type);
    t += dur;
  });
  return t; // returns end time
}

function playLoop(melody: Beat[], bass: Beat[], volume: number, bassVolume: number) {
  const c = getCtx();
  const now = c.currentTime;
  const melodyEnd = scheduleMelody(melody, now, volume);
  scheduleMelody(bass, now, bassVolume, 'sawtooth');
  // Schedule next loop just before end
  const loopDuration = melody.reduce((s, [, d]) => s + d, 0);
  musicTimer = setTimeout(() => {
    if (currentTrack !== null) playLoop(melody, bass, volume, bassVolume);
  }, (loopDuration - 0.1) * 1000);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startMusic(track: 'landing' | 'battle'): void {
  if (currentTrack === track) return;
  stopMusic();
  currentTrack = track;
  getCtx();
  if (track === 'landing') {
    playLoop(LANDING, LANDING_BASS, 0.4, 0.15);
  } else {
    playLoop(BATTLE, BATTLE_BASS, 0.4, 0.15);
  }
}

export function stopMusic(): void {
  currentTrack = null;
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
}

export function playSfx(type: 'eat' | 'levelUp' | 'powerUp' | 'gameOver' | 'bomb' | 'freeze' | 'shield'): void {
  if (_muted) return;
  const c = getCtx();
  const g = sfxGain!;
  const now = c.currentTime;

  switch (type) {
    case 'eat': {
      // Short ascending blip
      scheduleNote(N.E5, now,      0.06, 0.5, g);
      scheduleNote(N.A5, now+0.06, 0.06, 0.5, g);
      break;
    }
    case 'levelUp': {
      // Triumphant ascending fanfare
      [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => scheduleNote(f, now + i*0.1, 0.15, 0.5, g));
      break;
    }
    case 'powerUp': {
      // Rapid ascending arpeggio
      [N.G4, N.B4, N.D5, N.G5, N.B5].forEach((f, i) => scheduleNote(f, now + i*0.07, 0.1, 0.45, g));
      break;
    }
    case 'gameOver': {
      // Descending failure
      [N.C5, N.B4, N.G4, N.E4, N.C4].forEach((f, i) => scheduleNote(f, now + i*0.18, 0.25, 0.5, g, 'sawtooth'));
      break;
    }
    case 'bomb': {
      // Bass drop + noise burst
      [N.G4, N.E4, N.C4, N.G3].forEach((f, i) => scheduleNote(f, now + i*0.08, 0.15, 0.6, g, 'sawtooth'));
      scheduleNote(N.C3, now+0.32, 0.3, 0.7, g, 'sawtooth');
      break;
    }
    case 'freeze': {
      // Icy descending
      [N.B5, N.G5, N.E5, N.C5, N.A4].forEach((f, i) => scheduleNote(f, now + i*0.07, 0.1, 0.35, g));
      break;
    }
    case 'shield': {
      // Magical shimmer
      [N.E5, N.G5, N.B5, N.G5, N.E5].forEach((f, i) => scheduleNote(f, now + i*0.06, 0.09, 0.35, g));
      break;
    }
  }
}

export function setMuted(muted: boolean): void {
  _muted = muted;
  localStorage.setItem('arena_muted', String(muted));
  if (musicGain) musicGain.gain.value = muted ? 0 : 0.18;
  if (sfxGain)   sfxGain.gain.value   = muted ? 0 : 0.35;
}

export function isMuted(): boolean { return _muted; }
