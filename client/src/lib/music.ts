// ── Built-in beat engine — Web Audio API step sequencer ──────────────────────

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
let _stopFn: (() => void) | null = null;
let _volume = 0.45;
let _currentTrack = 0;
let _playing = false;

function ac(): AudioContext {
  if (!_ctx) {
    _ctx = new AudioContext();
    _master = _ctx.createGain();
    _master.gain.value = _volume;
    _master.connect(_ctx.destination);
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}
function mg(): GainNode { ac(); return _master!; }

export function setMusicVolume(v: number) {
  _volume = v;
  if (_master) _master.gain.linearRampToValueAtTime(v, ac().currentTime + 0.1);
}
export function isPlaying()        { return _playing; }
export function currentTrackIndex(){ return _currentTrack; }

// ── Instruments ───────────────────────────────────────────────────────────────

function kick(t: number, vol = 1) {
  const c = ac(); const g = c.createGain(); g.connect(mg());
  const o = c.createOscillator(); o.connect(g);
  o.frequency.setValueAtTime(100, t);
  o.frequency.exponentialRampToValueAtTime(0.001, t + 0.45);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.start(t); o.stop(t + 0.5);
}

function snare(t: number, vol = 0.45) {
  const c = ac();
  const sz = Math.floor(c.sampleRate * 0.13);
  const buf = c.createBuffer(1, sz, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < sz; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.04));
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2800; f.Q.value = 0.7;
  const g = c.createGain();
  src.connect(f); f.connect(g); g.connect(mg());
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  src.start(t); src.stop(t + 0.18);
}

function hat(t: number, open = false, vol = 0.1) {
  const c = ac();
  const dur = open ? 0.18 : 0.035;
  const sz = Math.floor(c.sampleRate * (dur + 0.01));
  const buf = c.createBuffer(1, sz, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < sz; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * (open ? 0.12 : 0.02)));
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 9000;
  const g = c.createGain();
  src.connect(f); f.connect(g); g.connect(mg());
  g.gain.setValueAtTime(vol, t); src.start(t); src.stop(t + dur + 0.02);
}

function bassNote(t: number, freq: number, dur: number, vol = 0.5) {
  const c = ac();
  const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 450;
  const g = c.createGain();
  o.connect(f); f.connect(g); g.connect(mg());
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.88);
  o.start(t); o.stop(t + dur + 0.02);
}

function pad(t: number, freq: number, dur: number, vol = 0.06) {
  const c = ac();
  [-0.015, 0, 0.015].forEach(dt => {
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq * (1 + dt);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200; f.Q.value = 1.5;
    const g = c.createGain();
    o.connect(f); f.connect(g); g.connect(mg());
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.12);
    g.gain.setValueAtTime(vol, t + dur - 0.15); g.gain.linearRampToValueAtTime(0, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  });
}

function lead(t: number, freq: number, dur: number, vol = 0.09, type: OscillatorType = 'square') {
  if (!freq) return;
  const c = ac();
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 2;
  const g = c.createGain();
  o.connect(f); f.connect(g); g.connect(mg());
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.82);
  o.start(t); o.stop(t + dur + 0.02);
}

// ── Note table ────────────────────────────────────────────────────────────────
const N: Record<string, number> = {
  C2:65.41, F2:87.31, G2:98, A2:110,
  C3:130.81, E3:164.81, F3:174.61, G3:196, A3:220,
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392, A4:440, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880,
};

// ── Track 1: Arena Battle (130 BPM synthwave) ─────────────────────────────────
function trackArenaBattle(start: number): () => void {
  const c = ac(); const bpm = 130; const s8 = 60/bpm/2; const bar = s8*8;
  const chords = [N.A2, N.F2, N.C3, N.G2];
  const pads   = [N.A3, N.F3, N.C4, N.G3];
  const melody = [
    [N.A4, 0,    N.C5, 0,    N.E5, N.D5, N.C5, 0   ],
    [N.F4, 0,    N.A4, 0,    N.C5, 0,    N.A4, 0   ],
    [N.C5, 0,    N.E5, N.D5, N.C5, 0,    N.G4, 0   ],
    [N.G4, 0,    N.B4, 0,    N.D5, N.B4, N.G4, 0   ],
  ];
  let alive = true; let tid: ReturnType<typeof setTimeout>;
  function bar_(bt: number, bi: number) {
    if (!alive) return;
    const ch = bi % 4;
    pad(bt, pads[ch], bar, 0.06);
    for (let i = 0; i < 8; i++) {
      const t = bt + i * s8;
      if (i===0||i===4) kick(t);
      if (i===2||i===6) snare(t);
      hat(t, false, 0.08);
      if (i===0) bassNote(t, chords[ch], s8*1.7);
      if (i===4) bassNote(t, chords[ch]*1.498, s8*1.5);
      const m = melody[ch][i]; if (m) lead(t, m, s8*0.75);
    }
    const next = bt + bar;
    tid = setTimeout(() => bar_(next, bi+1), Math.max(0, (next - c.currentTime)*1000 - 80));
  }
  bar_(start, 0);
  return () => { alive = false; clearTimeout(tid); };
}

// ── Track 2: Lo-fi Drift (82 BPM) ────────────────────────────────────────────
function trackLofiDrift(start: number): () => void {
  const c = ac(); const bpm = 82; const s8 = 60/bpm/2; const bar = s8*8;
  const chords = [N.A2, N.G2, N.C3, N.A2];
  const pads   = [N.A3, N.G3, N.C4, N.E3];
  const melody = [
    [N.E5, 0,    N.D5, N.C5, 0,    N.A4, 0,    0   ],
    [N.G4, 0,    N.A4, 0,    N.B4, 0,    N.G4, 0   ],
    [N.C5, N.E5, 0,    N.D5, N.C5, 0,    N.G4, 0   ],
    [N.B4, 0,    N.G4, 0,    N.A4, 0,    N.E4, 0   ],
  ];
  let alive = true; let tid: ReturnType<typeof setTimeout>;
  function bar_(bt: number, bi: number) {
    if (!alive) return;
    const ch = bi % 4;
    pad(bt, pads[ch], bar, 0.05);
    for (let i = 0; i < 8; i++) {
      const t = bt + i * s8;
      if (i===0) kick(t, 0.8); if (i===4) kick(t, 0.6);
      if (i===2||i===6) snare(t, 0.35);
      if (i%2===0) hat(t, false, 0.07);
      if (i===3||i===7) hat(t, true, 0.06);
      if (i===0) bassNote(t, chords[ch], s8*2.5, 0.4);
      if (i===5) bassNote(t, chords[ch]*1.333, s8*1.8, 0.35);
      const m = melody[ch][i]; if (m) lead(t, m, s8*0.9, 0.07, 'sine');
    }
    const next = bt + bar;
    tid = setTimeout(() => bar_(next, bi+1), Math.max(0, (next - c.currentTime)*1000 - 80));
  }
  bar_(start, 0);
  return () => { alive = false; clearTimeout(tid); };
}

// ── Track 3: Chiptune Rush (155 BPM) ─────────────────────────────────────────
function trackChiptuneRush(start: number): () => void {
  const c = ac(); const bpm = 155; const s16 = 60/bpm/4; const bar = s16*16;
  const bassSeq = [N.A2, N.A2, N.F2, N.F2, N.C3, N.C3, N.A2, N.A2];
  const arp = [
    [N.A4,N.C5,N.E5,N.A5,N.E5,N.C5,N.A4,0,  N.A4,N.C5,N.E5,N.A5,N.G5,N.E5,N.C5,0  ],
    [N.F4,N.A4,N.C5,N.F5,N.C5,N.A4,N.F4,0,  N.F4,N.A4,N.C5,N.F5,N.E5,N.C5,N.A4,0  ],
    [N.C4,N.E4,N.G4,N.C5,N.G4,N.E4,N.C4,0,  N.C4,N.E4,N.G4,N.C5,N.B4,N.G4,N.E4,0  ],
    [N.A4,N.C5,N.E5,N.A5,N.E5,N.C5,N.A4,0,  N.G4,N.B4,N.D5,N.G5,N.D5,N.B4,N.G4,0  ],
  ];
  let alive = true; let tid: ReturnType<typeof setTimeout>;
  function bar_(bt: number, bi: number) {
    if (!alive) return;
    const ch = bi % 4;
    for (let i = 0; i < 16; i++) {
      const t = bt + i * s16;
      if (i===0||i===8) kick(t, 0.9);
      if (i===4||i===12) snare(t, 0.4);
      hat(t, false, 0.06);
      if (i%2===0) bassNote(t, bassSeq[ch*2 + (i<8?0:1)] ?? N.A2, s16*1.5, 0.45);
      const m = arp[ch][i]; if (m) lead(t, m, s16*0.7, 0.1, 'square');
    }
    const next = bt + bar;
    tid = setTimeout(() => bar_(next, bi+1), Math.max(0, (next - c.currentTime)*1000 - 80));
  }
  bar_(start, 0);
  return () => { alive = false; clearTimeout(tid); };
}

// ── Public API ────────────────────────────────────────────────────────────────
export const TRACKS = [
  { name: 'Arena Battle' },
  { name: 'Lo-fi Drift'  },
  { name: 'Chiptune Rush'},
];

const PLAYERS = [trackArenaBattle, trackLofiDrift, trackChiptuneRush];

export function playTrack(idx: number) {
  _stopFn?.();
  _currentTrack = ((idx % TRACKS.length) + TRACKS.length) % TRACKS.length;
  _stopFn = PLAYERS[_currentTrack](ac().currentTime + 0.05);
  _playing = true;
}

export function stopMusic() {
  _stopFn?.(); _stopFn = null; _playing = false;
}

export function nextTrack() { playTrack(_currentTrack + 1); }
export function prevTrack() { playTrack(_currentTrack - 1); }
