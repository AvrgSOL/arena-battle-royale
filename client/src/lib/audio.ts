/**
 * EDM synthesizer — Web Audio API only, no files.
 *
 * Dubstep:  wobble bass (LFO → resonant lowpass filter), sidechain pump, half-time snare
 * Techno:   Reese bass (detuned saws), driving 4/4, dark minimal stabs
 *
 * Generation counter prevents any stale loop from continuing after navigation.
 */

// ── Audio context ─────────────────────────────────────────────────────────────
let ctx: AudioContext | null = null;
let masterOut: GainNode | null  = null;   // final output
let drumBus: GainNode | null    = null;   // kick / snare / hats
let bassBus: GainNode | null    = null;   // wobble / reese
let synthBus: GainNode | null   = null;   // stabs
let sfxBus: GainNode | null     = null;   // sound effects

let musicTimer: ReturnType<typeof setTimeout> | null = null;
let gen = 0;
let _muted = localStorage.getItem('arena_muted') === 'true';

function getCtx(): AudioContext {
  if (!ctx) {
    ctx         = new AudioContext();
    masterOut   = ctx.createGain(); masterOut.gain.value = 0.9;
    drumBus     = ctx.createGain(); drumBus.gain.value   = _muted ? 0 : 0.7;
    bassBus     = ctx.createGain(); bassBus.gain.value   = _muted ? 0 : 0.55;
    synthBus    = ctx.createGain(); synthBus.gain.value  = _muted ? 0 : 0.3;
    sfxBus      = ctx.createGain(); sfxBus.gain.value    = _muted ? 0 : 0.45;
    [drumBus, bassBus, synthBus, sfxBus].forEach(b => b!.connect(masterOut!));
    masterOut.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ── Drum synthesis ────────────────────────────────────────────────────────────

function kick(t: number, vol = 0.95): void {
  if (!ctx || !drumBus) return;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(0.001, t + 0.38);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(gain); gain.connect(drumBus);
  osc.start(t); osc.stop(t + 0.41);
}

function snare(t: number, vol = 0.38): void {
  if (!ctx || !drumBus) return;
  const len  = Math.ceil(ctx.sampleRate * 0.22);
  const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
  const src    = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain   = ctx.createGain();
  filter.type = 'bandpass'; filter.frequency.value = 2400; filter.Q.value = 0.9;
  src.buffer = buf;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  src.connect(filter); filter.connect(gain); gain.connect(drumBus);
  src.start(t); src.stop(t + 0.23);
}

function hat(t: number, vol = 0.16, open = false): void {
  if (!ctx || !drumBus) return;
  const dur  = open ? 0.1 : 0.035;
  const len  = Math.ceil(ctx.sampleRate * dur);
  const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src    = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain   = ctx.createGain();
  filter.type = 'highpass'; filter.frequency.value = 10000;
  src.buffer = buf;
  gain.gain.setValueAtTime(vol, t); gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter); filter.connect(gain); gain.connect(drumBus);
  src.start(t); src.stop(t + dur + 0.01);
}

// ── Wobble bass (dubstep) ─────────────────────────────────────────────────────
// Sawtooth → resonant lowpass → LFO modulates cutoff → that iconic "wob"

function wobble(freq: number, t: number, dur: number, lfoRate: number, vol = 0.7): void {
  if (!ctx || !bassBus) return;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth'; osc.frequency.value = freq;

  const sub = ctx.createOscillator();           // sub bass underneath for body
  sub.type = 'sine'; sub.frequency.value = freq / 2;

  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass'; filt.Q.value = 14; filt.frequency.value = 300;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine'; lfo.frequency.value = lfoRate;
  const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 1400;
  lfo.connect(lfoAmt); lfoAmt.connect(filt.frequency);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.015);
  env.gain.setValueAtTime(vol, t + dur * 0.92);
  env.gain.linearRampToValueAtTime(0, t + dur);

  const subEnv = ctx.createGain();
  subEnv.gain.setValueAtTime(vol * 0.5, t);
  subEnv.gain.setValueAtTime(vol * 0.5, t + dur * 0.92);
  subEnv.gain.linearRampToValueAtTime(0, t + dur);

  osc.connect(filt); filt.connect(env); env.connect(bassBus);
  sub.connect(subEnv); subEnv.connect(bassBus);

  osc.start(t); osc.stop(t + dur);
  sub.start(t); sub.stop(t + dur);
  lfo.start(t); lfo.stop(t + dur);
}

// ── Reese bass (techno) ───────────────────────────────────────────────────────
// Two slightly detuned sawtooths → lowpass filter → that dark grinding techno bass

function reese(freq: number, t: number, dur: number, vol = 0.65): void {
  if (!ctx || !bassBus) return;
  [1, 1.0045].forEach(detune => {
    const osc  = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const env  = ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = freq * detune;
    filt.type = 'lowpass'; filt.frequency.value = 900; filt.Q.value = 4;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol * 0.5, t + 0.02);
    env.gain.setValueAtTime(vol * 0.5, t + dur * 0.88);
    env.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(filt); filt.connect(env); env.connect(bassBus);
    osc.start(t); osc.stop(t + dur);
  });
}

// ── Synth stab ────────────────────────────────────────────────────────────────
function stab(freq: number, t: number, vol = 0.3): void {
  if (!ctx || !synthBus) return;
  const osc  = ctx.createOscillator();
  const filt = ctx.createBiquadFilter();
  const env  = ctx.createGain();
  osc.type = 'sawtooth'; osc.frequency.value = freq;
  filt.type = 'lowpass'; filt.frequency.value = 2200; filt.Q.value = 2;
  env.gain.setValueAtTime(vol, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(filt); filt.connect(env); env.connect(synthBus);
  osc.start(t); osc.stop(t + 0.13);
}

// ── White noise riser (build-up before drop) ──────────────────────────────────
function riser(t: number, dur: number): void {
  if (!ctx || !synthBus) return;
  const len  = Math.ceil(ctx.sampleRate * dur);
  const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (i / len);
  const src  = ctx.createBufferSource();
  const filt = ctx.createBiquadFilter();
  const env  = ctx.createGain();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(300, t);
  filt.frequency.exponentialRampToValueAtTime(6000, t + dur * 0.9);
  filt.Q.value = 3;
  src.buffer = buf;
  env.gain.setValueAtTime(0.08, t);
  env.gain.linearRampToValueAtTime(0.35, t + dur * 0.85);
  env.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(filt); filt.connect(env); env.connect(synthBus);
  src.start(t); src.stop(t + dur);
}

// ── Sidechain pump (volume ducks on every kick) ───────────────────────────────
function sidechain(bus: GainNode, startT: number, beat: number, bars: number, baseVol: number): void {
  const total = bars * 4;
  for (let i = 0; i < total; i++) {
    const t = startT + i * beat;
    bus.gain.setValueAtTime(baseVol * 0.08, t + 0.001);
    bus.gain.linearRampToValueAtTime(baseVol, t + beat * 0.75);
  }
}

// ── Generation / loop control ─────────────────────────────────────────────────
export function stopMusic(): void {
  gen++;
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
}

// ── LANDING — Dubstep drop (138 BPM) ─────────────────────────────────────────
const DSTEP_BPM = 138;

// Wobble pattern: [freq, bars, lfoRate]
const WOBBLE_PATTERN: [number, number, number][] = [
  [55.00, 2, 3.0],   // A1 - slow wob
  [41.20, 2, 5.0],   // E1 - faster
  [43.65, 2, 4.0],   // F1
  [49.00, 1, 7.0],   // G1 - intense
  [55.00, 1, 9.0],   // A1 - rapid fire
];

function playDubstep(myGen: number): void {
  if (gen !== myGen) return;
  const c = getCtx();
  const beat = 60 / DSTEP_BPM;
  const bar  = beat * 4;
  let now = c.currentTime + 0.05;

  // ── Build (4 bars) — kick + hats + riser, no bass yet ──────────────────────
  const buildBars = 4;
  for (let b = 0; b < buildBars; b++) {
    const bs = now + b * bar;
    kick(bs);                                    // downbeat only
    kick(bs + beat * 2);                         // beat 3
    for (let h = 0; h < 8; h++) hat(bs + h * beat / 2, 0.1 + b * 0.03);
    if (b === 2) {                               // snare starts bar 3
      snare(bs + beat, 0.2); snare(bs + beat * 3, 0.2);
    }
    if (b === 3) {
      snare(bs + beat, 0.3); snare(bs + beat * 3, 0.3);
    }
  }
  riser(now + bar, bar * 3);                     // riser starts bar 2

  // ── Drop ───────────────────────────────────────────────────────────────────
  const dropStart = now + buildBars * bar;
  let wt = dropStart;

  WOBBLE_PATTERN.forEach(([freq, bars, rate]) => {
    const dur = bars * bar;
    // Schedule kick/snare for these bars
    for (let b = 0; b < bars; b++) {
      const bs = wt + b * bar;
      kick(bs);            kick(bs + beat * 0.5);   // boom boom
      kick(bs + beat * 2); kick(bs + beat * 2.5);   // boom boom
      snare(bs + beat);                              // half-time snare on 2
      snare(bs + beat * 3);                          // and 4
      for (let h = 0; h < 16; h++) hat(bs + h * beat / 4, 0.13 + (h % 2) * 0.06);
    }
    wobble(freq, wt, dur, rate);
    // Synth stab accent on every 2nd beat
    for (let b = 0; b < bars; b++) {
      stab(freq * 8, wt + b * bar + beat, 0.22);
      stab(freq * 8, wt + b * bar + beat * 3, 0.18);
    }
    wt += dur;
  });

  // Sidechain pump the bass bus during drop
  const totalDropBars = WOBBLE_PATTERN.reduce((s, [,b]) => s + b, 0);
  if (bassBus) sidechain(bassBus, dropStart, beat, totalDropBars, 0.55);

  const totalLen = (buildBars + totalDropBars) * bar;
  musicTimer = setTimeout(() => playDubstep(myGen), (totalLen - 0.1) * 1000);
}

// ── BATTLE — Dark Techno (140 BPM) ───────────────────────────────────────────
const TECHNO_BPM = 140;

// Reese pattern: [freq, beats duration] cycling over 8 bars
const REESE_SEQ: [number, number][] = [
  [55.00, 2],[55.00, 2],   // A1 × 2 bars
  [41.20, 2],[41.20, 2],   // E1 × 2 bars
  [43.65, 2],[43.65, 2],   // F1 × 2 bars
  [49.00, 1],[55.00, 1],[49.00, 2], // G→A→G tension
];

// Sparse dark stab melody (just 3 notes — not a running melody)
const STAB_PATTERN: [number, number][] = [  // [beat_offset_in_bar, freq]
  [1, 220], [7, 164.81], [13, 185.00],
];

function playTechno(myGen: number): void {
  if (gen !== myGen) return;
  const c = getCtx();
  const beat = 60 / TECHNO_BPM;
  const bar  = beat * 4;
  const bars = 8;
  const now  = c.currentTime + 0.05;

  // Drums — 4/4 kick, snare 2+4, 16th hats
  for (let b = 0; b < bars; b++) {
    const bs = now + b * bar;
    for (let i = 0; i < 4; i++) {
      kick(bs + i * beat, 0.85);
      if (i % 2 === 1) snare(bs + i * beat, 0.3);
    }
    for (let h = 0; h < 16; h++) hat(bs + h * beat / 4, 0.12 + (h % 4 === 0 ? 0.06 : 0));
  }

  // Reese bass
  let rt = now;
  REESE_SEQ.forEach(([freq, beatDur]) => {
    reese(freq, rt, beatDur * beat, 0.6);
    rt += beatDur * beat;
  });

  // Sparse stab accents — dark but not melodic
  for (let b = 0; b < bars; b += 2) {
    const bs = now + b * bar;
    STAB_PATTERN.forEach(([beatOff, freq]) => {
      stab(freq, bs + beatOff * beat, 0.22);
    });
  }

  // Sidechain pump bass on every kick
  if (bassBus) sidechain(bassBus, now, beat, bars, 0.55);

  musicTimer = setTimeout(() => playTechno(myGen), (bars * bar - 0.1) * 1000);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startMusic(track: 'landing' | 'battle'): void {
  stopMusic();
  const myGen = gen;
  getCtx();
  if (track === 'landing') playDubstep(myGen);
  else playTechno(myGen);
}

// ── SFX ───────────────────────────────────────────────────────────────────────

function sfxOsc(freq: number, t: number, dur: number, vol: number, type: OscillatorType = 'square'): void {
  if (!ctx || !sfxBus || freq === 0) return;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type; osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.linearRampToValueAtTime(0, t + dur * 0.85);
  osc.connect(gain); gain.connect(sfxBus);
  osc.start(t); osc.stop(t + dur);
}

export function playSfx(type: 'eat' | 'levelUp' | 'powerUp' | 'gameOver' | 'bomb' | 'freeze' | 'shield'): void {
  if (_muted) return;
  const c = getCtx();
  const t = c.currentTime;
  switch (type) {
    case 'eat':
      sfxOsc(659, t, 0.07, 0.4); sfxOsc(880, t+0.07, 0.07, 0.4);
      break;
    case 'levelUp':
      [523, 659, 784, 1046].forEach((f,i) => sfxOsc(f, t+i*0.09, 0.13, 0.4));
      break;
    case 'powerUp':
      wobble(110, t, 0.4, 8, 0.5);
      break;
    case 'gameOver':
      kick(t, 0.5); kick(t+0.06, 0.4);
      [523, 494, 392, 330, 261].forEach((f,i) => sfxOsc(f, t+i*0.14, 0.2, 0.4, 'sawtooth'));
      break;
    case 'bomb':
      kick(t, 1.0); kick(t+0.04, 0.8); kick(t+0.1, 0.6);
      wobble(55, t, 0.5, 5, 0.8);
      break;
    case 'freeze':
      [1318, 1047, 784, 523, 440].forEach((f,i) => sfxOsc(f, t+i*0.065, 0.09, 0.3));
      break;
    case 'shield':
      reese(220, t, 0.3, 0.4);
      [659, 784, 987].forEach((f,i) => sfxOsc(f, t+i*0.07, 0.1, 0.3));
      break;
  }
}

export function setMuted(muted: boolean): void {
  _muted = muted;
  localStorage.setItem('arena_muted', String(muted));
  const v = (base: number) => muted ? 0 : base;
  if (drumBus)  drumBus.gain.value  = v(0.7);
  if (bassBus)  bassBus.gain.value  = v(0.55);
  if (synthBus) synthBus.gain.value = v(0.3);
  if (sfxBus)   sfxBus.gain.value   = v(0.45);
}

export function isMuted(): boolean { return _muted; }
