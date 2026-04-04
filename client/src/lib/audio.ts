/**
 * EDM / Techno audio engine — synthesized drums, fat bass, big leads.
 * No audio files. Web Audio API only.
 *
 * Landing: Hardwell / Spaceman big-room progressive house
 * Battle:  Big Wild melodic bass — emotional, organic, suspenseful
 */

// ── Note frequencies ──────────────────────────────────────────────────────────
const N: Record<string, number> = {
  A1:55.00,
  C2:65.41, D2:73.42, E2:82.41, F2:87.31, G2:98.00, A2:110.00, B2:123.47,
  C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.00, A3:220.00, B3:246.94,
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00, B5:987.77,
  C6:1046.50, D6:1174.66, E6:1318.51, F6:1396.91,
  R:0,
};

type Beat = [number, number]; // [freq_hz, duration_sec]

// ── LANDING — "SPACEMAN" (Hardwell big room progressive house, 128 BPM) ───────
// beat = 0.469s · 8th = 0.234s · 16th = 0.117s

// Build: euphoric rising arpeggio (sweeps up into the drop)
const BUILD_MELODY: Beat[] = [
  [N.F4,.117],[N.A4,.117],[N.C5,.117],[N.F5,.117],[N.A5,.117],[N.C6,.117],[N.A5,.117],[N.F5,.117],
  [N.G4,.117],[N.B4,.117],[N.D5,.117],[N.G5,.117],[N.B5,.117],[N.D6,.117],[N.B5,.117],[N.G5,.117],
  // faster sweep
  [N.F4,.083],[N.A4,.083],[N.C5,.083],[N.F5,.083],[N.A5,.083],[N.C6,.083],[N.F6,.083],[N.E6,.083],
  [N.D6,.083],[N.C6,.083],[N.A5,.083],[N.G5,.083],[N.F5,.083],[N.E5,.083],[N.D5,.083],[N.R,.083],
  // silence — anticipation
  [N.R,.469],
];

// Drop: big room lead synth melody (Spaceman-esque euphoric lead)
const DROP_MELODY: Beat[] = [
  // Phrase 1 — uplifting hook
  [N.F5,.234],[N.A5,.234],[N.C6,.469],[N.A5,.234],[N.G5,.234],
  [N.A5,.234],[N.G5,.234],[N.F5,.469],[N.R,.234],[N.F5,.234],
  // Phrase 2 — answering phrase
  [N.G5,.234],[N.A5,.234],[N.C6,.469],[N.G5,.469],
  [N.F5,.234],[N.E5,.234],[N.F5,.234],[N.G5,.234],[N.A5,.469],
  // Phrase 3 — builds higher
  [N.C6,.234],[N.D6,.234],[N.C6,.234],[N.A5,.234],[N.G5,.469],[N.F5,.469],
  // Resolution
  [N.A5,.234],[N.G5,.234],[N.F5,.234],[N.E5,.234],[N.F5,.938],
];

// Synth bass — fat sawtooth stabs under the drop
const DROP_BASS: Beat[] = [
  [N.F2,.469],[N.R,.469], [N.F2,.469],[N.R,.469],
  [N.C2,.469],[N.R,.469], [N.G2,.469],[N.R,.469],
  [N.F2,.469],[N.R,.469], [N.F2,.469],[N.C2,.234],[N.R,.234],
  [N.A2,.234],[N.G2,.234],[N.F2,.469],[N.C2,.469],[N.R,.469],
  [N.F2,.469],[N.R,.234],[N.F2,.234],[N.C2,.469],[N.R,.469],
  [N.G2,.469],[N.A2,.469],[N.R,.469],[N.C2,.469],
  [N.F2,.469],[N.G2,.234],[N.A2,.234],[N.G2,.469],[N.F2,.469],
];

// ── BATTLE — "AWAKEN" (Big Wild melodic bass / organic electronic, 122 BPM) ───
// beat = 0.492s · 8th = 0.246s · 16th = 0.123s

// Emotional lead melody — stepwise, tension + release
const WILD_MELODY: Beat[] = [
  // Opens sparse — just bass first
  [N.R, 0.984],
  // Emotional phrase enters
  [N.A4,.246],[N.R,.123],[N.A4,.123],[N.B4,.246],[N.C5,.492],
  [N.D5,.246],[N.C5,.246],[N.B4,.492],[N.R,.492],
  // Tension rises
  [N.C5,.246],[N.R,.123],[N.C5,.123],[N.D5,.246],[N.E5,.492],
  [N.F5,.246],[N.E5,.246],[N.D5,.492],[N.R,.246],[N.A4,.246],
  // Big build — ascending run
  [N.A4,.123],[N.B4,.123],[N.C5,.123],[N.D5,.123],[N.E5,.123],[N.F5,.123],[N.G5,.123],[N.A5,.123],
  // Drop into the groove — syncopated
  [N.A5,.246],[N.R,.123],[N.A5,.123],[N.G5,.246],[N.F5,.492],
  [N.E5,.246],[N.F5,.246],[N.G5,.246],[N.A5,.246],[N.R,.492],
  // Resolution
  [N.D5,.246],[N.E5,.246],[N.F5,.246],[N.E5,.246],
  [N.D5,.492],[N.A4,.492],
  [N.A4,.984],
];

// Big Wild bass — warm, wobbly, syncopated
const WILD_BASS: Beat[] = [
  [N.A2,.123],[N.R,.369],   [N.A2,.123],[N.R,.369],   // sparse open
  [N.A2,.246],[N.G2,.246],  [N.A2,.246],[N.R,.246],
  [N.D2,.492],[N.R,.246],[N.D2,.246],
  [N.E2,.246],[N.R,.246],   [N.E2,.246],[N.A2,.246],
  // Groove locks in
  [N.A2,.123],[N.A2,.123],[N.R,.123],[N.A2,.123],[N.R,.123],[N.G2,.123],[N.A2,.123],[N.R,.123],
  [N.F2,.246],[N.E2,.246],[N.R,.246],[N.A2,.246],
  [N.A2,.123],[N.A2,.123],[N.R,.123],[N.A2,.123],[N.C3,.246],[N.R,.246],
  [N.G2,.246],[N.F2,.246],[N.E2,.492],[N.R,.492],
  [N.A2,.246],[N.R,.246],[N.A2,.246],[N.R,.246],
  [N.D2,.492],[N.E2,.492],
  [N.A2,.984],
];

// ── Engine ────────────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let drumGain: GainNode | null = null;
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let gen = 0;
let _muted = localStorage.getItem('arena_muted') === 'true';

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = _muted ? 0 : 0.22;
    musicGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = _muted ? 0 : 0.4;
    sfxGain.connect(masterGain);

    drumGain = ctx.createGain();
    drumGain.gain.value = _muted ? 0 : 0.55;
    drumGain.connect(masterGain);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ── Synth drum generators ─────────────────────────────────────────────────────

function kick(time: number, vol = 0.9): void {
  if (!ctx || !drumGain) return;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(160, time);
  osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.35);
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
  osc.connect(gain); gain.connect(drumGain);
  osc.start(time); osc.stop(time + 0.36);
}

function snare(time: number, vol = 0.35): void {
  if (!ctx || !drumGain) return;
  const len    = Math.ceil(ctx.sampleRate * 0.18);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data   = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.8;
  const src    = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain   = ctx.createGain();
  filter.type = 'bandpass'; filter.frequency.value = 2200; filter.Q.value = 0.8;
  src.buffer = buffer;
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
  src.connect(filter); filter.connect(gain); gain.connect(drumGain);
  src.start(time); src.stop(time + 0.19);
}

function hihat(time: number, vol = 0.18, open = false): void {
  if (!ctx || !drumGain) return;
  const dur    = open ? 0.12 : 0.04;
  const len    = Math.ceil(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data   = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src    = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain   = ctx.createGain();
  filter.type = 'highpass'; filter.frequency.value = 9000;
  src.buffer = buffer;
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  src.connect(filter); filter.connect(gain); gain.connect(drumGain);
  src.start(time); src.stop(time + dur + 0.01);
}

// Schedule 4-on-floor beat (classic big room house)
function scheduleBigRoom(startTime: number, bars: number, bpm: number): void {
  const beat = 60 / bpm;
  const total = bars * 4;
  for (let i = 0; i < total; i++) {
    const t = startTime + i * beat;
    kick(t);
    if (i % 2 === 1) snare(t, 0.32);
    // 16th note hi-hats
    for (let h = 0; h < 4; h++) {
      const ht = t + h * beat / 4;
      const isOpen = h === 2 && i % 2 === 0;
      hihat(ht, h % 2 === 0 ? 0.2 : 0.12, isOpen);
    }
  }
}

// Big Wild style — syncopated, organic drum pattern
function scheduleOrganic(startTime: number, bars: number, bpm: number): void {
  const beat = 60 / bpm;
  // Pattern per bar (in 16th-note offsets from bar start): kick times
  const kickOffsets  = [0, 2.5, 4, 6.5, 8, 10.5, 12];
  const snareOffsets = [2, 6, 10, 14];
  const hatOffsets   = [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15];

  for (let bar = 0; bar < bars; bar++) {
    const barStart = startTime + bar * 4 * beat;
    const sixteenth = beat / 4;
    kickOffsets.forEach(o  => kick(barStart + o * sixteenth, 0.8));
    snareOffsets.forEach(o => snare(barStart + o * sixteenth, 0.28));
    hatOffsets.forEach(o   => hihat(barStart + o * sixteenth, 0.14));
  }
}

// ── Melody/bass scheduler ─────────────────────────────────────────────────────

function scheduleBeats(beats: Beat[], startTime: number, vol: number, type: OscillatorType = 'square'): number {
  const c = getCtx();
  let t = startTime;
  beats.forEach(([freq, dur]) => {
    if (freq > 0 && musicGain) {
      const osc  = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.linearRampToValueAtTime(0, t + dur * 0.88);
      osc.connect(gain); gain.connect(musicGain);
      osc.start(t); osc.stop(t + dur);
    }
    t += dur;
  });
  return t;
}

function len(beats: Beat[]): number { return beats.reduce((s,[,d]) => s + d, 0); }

// ── Public API ────────────────────────────────────────────────────────────────

export function stopMusic(): void {
  gen++;
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
}

export function startMusic(track: 'landing' | 'battle'): void {
  stopMusic();
  const myGen = gen;
  getCtx();

  if (track === 'landing') {
    // 128 BPM big room house — build → drop → repeat
    const BPM = 128;
    const buildBars = 2;
    const dropBars  = 8;

    function playLanding() {
      if (gen !== myGen) return;
      const c   = getCtx();
      const now = c.currentTime;
      const buildLen = len(BUILD_MELODY);

      // Build phase — arpeggio only, kick builds in
      scheduleBeats(BUILD_MELODY, now, 0.5);
      scheduleBigRoom(now + buildLen * 0.5, buildBars, BPM); // drums enter halfway through build

      // Drop phase
      const dropStart = now + buildLen;
      scheduleBeats(DROP_MELODY, dropStart, 0.45);
      scheduleBeats(DROP_BASS,   dropStart, 0.6, 'sawtooth');
      scheduleBigRoom(dropStart, dropBars, BPM);

      const totalLen = buildLen + len(DROP_MELODY);
      musicTimer = setTimeout(playLanding, (totalLen - 0.05) * 1000);
    }
    playLanding();

  } else {
    // 122 BPM Big Wild organic melodic bass
    const BPM = 122;
    const bars = 10;

    function playBattle() {
      if (gen !== myGen) return;
      const c   = getCtx();
      const now = c.currentTime;
      scheduleBeats(WILD_MELODY, now, 0.45);
      scheduleBeats(WILD_BASS,   now, 0.6, 'sawtooth');
      scheduleOrganic(now, bars, BPM);

      const totalLen = len(WILD_MELODY);
      musicTimer = setTimeout(playBattle, (totalLen - 0.05) * 1000);
    }
    playBattle();
  }
}

// ── SFX ───────────────────────────────────────────────────────────────────────

function sfxNote(freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'square'): void {
  if (!ctx || !sfxGain || freq === 0) return;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, start);
  gain.gain.linearRampToValueAtTime(0, start + dur * 0.85);
  osc.connect(gain); gain.connect(sfxGain);
  osc.start(start); osc.stop(start + dur);
}

export function playSfx(type: 'eat' | 'levelUp' | 'powerUp' | 'gameOver' | 'bomb' | 'freeze' | 'shield'): void {
  if (_muted) return;
  const c = getCtx();
  const now = c.currentTime;
  switch (type) {
    case 'eat':
      sfxNote(N.E5, now, 0.06, 0.45);
      sfxNote(N.A5, now+0.06, 0.06, 0.45);
      break;
    case 'levelUp':
      [N.C5,N.E5,N.G5,N.C6].forEach((f,i) => sfxNote(f, now+i*0.09, 0.14, 0.45));
      break;
    case 'powerUp':
      [N.G4,N.B4,N.D5,N.G5,N.B5].forEach((f,i) => sfxNote(f, now+i*0.06, 0.09, 0.4));
      break;
    case 'gameOver':
      kick(now, 0.5);
      [N.C5,N.B4,N.G4,N.E4,N.C4].forEach((f,i) => sfxNote(f, now+i*0.16, 0.22, 0.45, 'sawtooth'));
      break;
    case 'bomb':
      kick(now, 1.0); kick(now+0.05, 0.7);
      [N.G4,N.E4,N.C4,N.G3,N.A2].forEach((f,i) => sfxNote(f, now+i*0.07, 0.14, 0.5, 'sawtooth'));
      break;
    case 'freeze':
      [N.B5,N.G5,N.E5,N.C5,N.A4].forEach((f,i) => sfxNote(f, now+i*0.06, 0.09, 0.32));
      break;
    case 'shield':
      [N.E5,N.G5,N.B5,N.G5,N.E5].forEach((f,i) => sfxNote(f, now+i*0.055, 0.08, 0.3));
      break;
  }
}

export function setMuted(muted: boolean): void {
  _muted = muted;
  localStorage.setItem('arena_muted', String(muted));
  if (musicGain) musicGain.gain.value = muted ? 0 : 0.22;
  if (sfxGain)   sfxGain.gain.value   = muted ? 0 : 0.4;
  if (drumGain)  drumGain.gain.value  = muted ? 0 : 0.55;
}

export function isMuted(): boolean { return _muted; }
