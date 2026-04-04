/**
 * 8-bit chiptune audio engine — Web Audio API, no files.
 *
 * Fix: generation counter prevents any stale loop from continuing after
 * stopMusic() or a new startMusic() call, eliminating overlap on navigation.
 */

// ── Note table ────────────────────────────────────────────────────────────────
const N: Record<string, number> = {
  // Sub-bass / bass register
  A1:55.00, E2:82.41, F2:87.31, G2:98.00, A2:110.00, B2:123.47,
  C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.00, A3:220.00, B3:246.94,
  // Mid register
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
  // High register
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00, B5:987.77,
  C6:1046.50, E6:1318.51,
  R:0,
};

type Beat = [number, number]; // [freq, duration_seconds]

// ── LANDING — "THE DROP" ─────────────────────────────────────────────────────
// 175 BPM · Heavy 8-bit bass drop / techno intro
// 16th = 0.086s  8th = 0.171s  quarter = 0.343s

// Phase A: rapid ascending build (tension before drop)
const BUILD: Beat[] = [
  [N.A4,.171],[N.C5,.171],[N.E5,.171],[N.A5,.171],[N.E5,.171],[N.C5,.171],
  [N.A4,.171],[N.C5,.171],[N.E5,.171],[N.A5,.171],[N.C6,.171],[N.A5,.171],
  // faster 32nds
  [N.E5,.086],[N.A5,.086],[N.C6,.086],[N.E6,.086],[N.C6,.086],[N.A5,.086],[N.E5,.086],[N.C5,.086],
  [N.A4,.086],[N.C5,.086],[N.E5,.086],[N.A5,.086],[N.E5,.086],[N.C5,.086],[N.A4,.086],[N.R,.086],
  // dramatic pause / hold
  [N.R,.343],
];

// Phase B: THE DROP — aggressive power riff in A minor
const DROP: Beat[] = [
  [N.A4,.086],[N.A4,.086],[N.R,.086],[N.A4,.086],[N.R,.086],[N.G4,.086],[N.A4,.086],[N.R,.086],
  [N.F4,.171],[N.R,.086],[N.E4,.086],[N.R,.343],
  [N.A4,.086],[N.A4,.086],[N.R,.086],[N.A4,.086],[N.C5,.171],[N.R,.086],[N.G4,.086],[N.F4,.086],
  [N.E4,.343],[N.R,.086],[N.E4,.086],[N.D4,.086],[N.E4,.086],
  // second phrase — higher
  [N.C5,.086],[N.C5,.086],[N.R,.086],[N.C5,.086],[N.R,.086],[N.B4,.086],[N.C5,.086],[N.R,.086],
  [N.A4,.171],[N.R,.086],[N.G4,.086],[N.R,.343],
  [N.E5,.086],[N.D5,.086],[N.C5,.086],[N.B4,.086],[N.A4,.086],[N.B4,.086],[N.C5,.086],[N.R,.086],
  [N.A4,.686],
];

// Heavy bass line during drop
const DROP_BASS: Beat[] = [
  [N.A2,.086],[N.A2,.086],[N.R,.086],[N.A2,.086],[N.R,.086],[N.G2,.086],[N.A2,.086],[N.R,.086],
  [N.F2,.171],[N.E2,.171],[N.R,.343],
  [N.A2,.086],[N.A2,.086],[N.R,.086],[N.A2,.086],[N.A2,.171],[N.G2,.086],[N.F2,.086],
  [N.E2,.343],[N.A2,.171],[N.R,.171],
  [N.C3,.086],[N.C3,.086],[N.R,.086],[N.C3,.086],[N.R,.086],[N.B2,.086],[N.C3,.086],[N.R,.086],
  [N.A2,.171],[N.G2,.171],[N.R,.343],
  [N.E3,.171],[N.D3,.171],[N.C3,.171],[N.B2,.171],
  [N.A2,.686],
];

// ── BATTLE — "HUNTED" ─────────────────────────────────────────────────────────
// 90 BPM · Slow, suspenseful John Carpenter-style 8-bit thriller
// quarter = 0.667s  8th = 0.333s  16th = 0.167s

const HUNT: Beat[] = [
  // Opens with silence — just bass thumps for 2 bars
  [N.R, 1.333],
  // Sparse, creepy melody enters
  [N.A4,.167],[N.R,.167],[N.A4,.083],[N.R,.083],[N.G4,.333],
  [N.F4,.25], [N.E4,.083],[N.R,.583],
  // Second phrase — rising dread
  [N.A4,.167],[N.B4,.167],[N.C5,.167],[N.R,.167],
  [N.B4,.333],[N.R,.333],
  // Third phrase — tension climb
  [N.C5,.167],[N.R,.167],[N.C5,.083],[N.R,.083],[N.B4,.333],
  [N.A4,.25], [N.G4,.083],[N.R,.583],
  // Climax — descending run, then ominous hold
  [N.E5,.167],[N.D5,.167],[N.C5,.167],[N.B4,.167],
  [N.A4,.333],[N.R,.167],[N.A4,.167],
  [N.A4,.667],
];

// Ominous bass pulses (heartbeat feel)
const HUNT_BASS: Beat[] = [
  [N.A2,.083],[N.R,.583], [N.A2,.083],[N.R,.583],   // bar 1-2
  [N.A2,.083],[N.R,.583], [N.E2,.083],[N.R,.583],   // bar 3-4
  [N.A2,.083],[N.R,.333],[N.A2,.083],[N.R,.167],    // bar 5
  [N.F2,.083],[N.R,.583],                            // bar 6
  [N.E2,.083],[N.R,.583], [N.E2,.083],[N.R,.583],   // bar 7-8
  [N.A2,.083],[N.R,.333],[N.A2,.083],[N.R,.333],    // bar 9
  [N.G2,.083],[N.R,.583],                            // bar 10
  [N.A2,.083],[N.R,.333],[N.E2,.083],[N.R,.167],    // bar 11
  [N.A2,.083],[N.R,.583],                            // bar 12
  [N.A1,.167],[N.R,.5],                              // low sub-bass hit
  [N.A2,.667],
];

// ── Engine ────────────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let gen = 0; // generation counter — increment on every stop/start to kill stale loops

let _muted = localStorage.getItem('arena_muted') === 'true';

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = _muted ? 0 : 0.2;
    musicGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = _muted ? 0 : 0.4;
    sfxGain.connect(masterGain);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function scheduleNote(
  freq: number, start: number, dur: number,
  vol: number, target: GainNode, type: OscillatorType = 'square',
): void {
  if (!ctx || freq === 0) return;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, start);
  gain.gain.linearRampToValueAtTime(0, start + dur * 0.85);
  osc.connect(gain);
  gain.connect(target);
  osc.start(start);
  osc.stop(start + dur);
}

function schedulePhase(beats: Beat[], startTime: number, vol: number, type: OscillatorType = 'square'): number {
  const c = getCtx();
  let t = startTime;
  beats.forEach(([freq, dur]) => { scheduleNote(freq, t, dur, vol, musicGain!, type); t += dur; });
  return t;
}

function phaseLen(beats: Beat[]): number { return beats.reduce((s, [, d]) => s + d, 0); }

// ── Public API ────────────────────────────────────────────────────────────────

export function stopMusic(): void {
  gen++;
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
}

export function startMusic(track: 'landing' | 'battle'): void {
  stopMusic(); // kill any running loop + increment gen
  const myGen = gen;
  getCtx();

  if (track === 'landing') {
    function playLanding() {
      if (gen !== myGen) return;
      const c = getCtx();
      const now = c.currentTime;
      const buildEnd = schedulePhase(BUILD, now, 0.45);
      schedulePhase(DROP,      buildEnd, 0.5);
      schedulePhase(DROP_BASS, buildEnd, 0.55, 'sawtooth');
      const total = phaseLen(BUILD) + phaseLen(DROP);
      musicTimer = setTimeout(playLanding, (total - 0.05) * 1000);
    }
    playLanding();
  } else {
    function playBattle() {
      if (gen !== myGen) return;
      const c = getCtx();
      const now = c.currentTime;
      schedulePhase(HUNT,      now, 0.45);
      schedulePhase(HUNT_BASS, now, 0.6, 'sawtooth');
      const total = phaseLen(HUNT);
      musicTimer = setTimeout(playBattle, (total - 0.05) * 1000);
    }
    playBattle();
  }
}

// ── SFX ───────────────────────────────────────────────────────────────────────

export function playSfx(type: 'eat' | 'levelUp' | 'powerUp' | 'gameOver' | 'bomb' | 'freeze' | 'shield'): void {
  if (_muted) return;
  const c = getCtx();
  const g = sfxGain!;
  const now = c.currentTime;

  switch (type) {
    case 'eat':
      scheduleNote(N.E5, now,      0.06, 0.5, g);
      scheduleNote(N.A5, now+0.06, 0.06, 0.5, g);
      break;
    case 'levelUp':
      [N.C5,N.E5,N.G5,N.C6].forEach((f,i) => scheduleNote(f, now+i*0.1, 0.15, 0.5, g));
      break;
    case 'powerUp':
      [N.G4,N.B4,N.D5,N.G5,N.B5].forEach((f,i) => scheduleNote(f, now+i*0.07, 0.1, 0.45, g));
      break;
    case 'gameOver':
      [N.C5,N.B4,N.G4,N.E4,N.C4].forEach((f,i) => scheduleNote(f, now+i*0.18, 0.25, 0.5, g, 'sawtooth'));
      break;
    case 'bomb':
      [N.G4,N.E4,N.C4,N.G3].forEach((f,i) => scheduleNote(f, now+i*0.08, 0.15, 0.6, g, 'sawtooth'));
      scheduleNote(N.A2, now+0.32, 0.4, 0.8, g, 'sawtooth');
      break;
    case 'freeze':
      [N.B5,N.G5,N.E5,N.C5,N.A4].forEach((f,i) => scheduleNote(f, now+i*0.07, 0.1, 0.35, g));
      break;
    case 'shield':
      [N.E5,N.G5,N.B5,N.G5,N.E5].forEach((f,i) => scheduleNote(f, now+i*0.06, 0.09, 0.35, g));
      break;
  }
}

export function setMuted(muted: boolean): void {
  _muted = muted;
  localStorage.setItem('arena_muted', String(muted));
  if (musicGain) musicGain.gain.value = muted ? 0 : 0.2;
  if (sfxGain)   sfxGain.gain.value   = muted ? 0 : 0.4;
}

export function isMuted(): boolean { return _muted; }
