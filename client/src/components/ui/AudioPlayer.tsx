import { useState } from 'react';
import {
  TRACKS, playTrack, stopMusic, nextTrack, prevTrack,
  setMusicVolume, isPlaying, currentTrackIndex,
} from '../../lib/music';

function toSpotifyEmbed(url: string): string | null {
  const match = url.match(/spotify\.com\/(playlist|album|track|artist)\/([A-Za-z0-9]+)/);
  if (!match) return null;
  return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
}

type Mode = 'beats' | 'spotify';

export default function AudioPlayer() {
  const [mode, setMode]           = useState<Mode>('beats');
  const [playing, setPlaying]     = useState(false);
  const [trackIdx, setTrackIdx]   = useState(0);
  const [volume, setVolume]       = useState(0.45);
  const [embedUrl, setEmbedUrl]   = useState<string | null>(null);
  const [spotifyInput, setSpotifyInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [showPlayer, setShowPlayer] = useState(true);

  function toggle() {
    if (playing) { stopMusic(); setPlaying(false); }
    else         { playTrack(trackIdx); setPlaying(true); }
  }

  function skip(dir: 1 | -1) {
    const next = ((trackIdx + dir) % TRACKS.length + TRACKS.length) % TRACKS.length;
    setTrackIdx(next);
    if (playing) dir === 1 ? nextTrack() : prevTrack();
  }

  function handleVolume(v: number) {
    setVolume(v);
    setMusicVolume(v);
  }

  function switchMode(m: Mode) {
    if (m === 'beats' && mode !== 'beats') { stopMusic(); setPlaying(false); }
    setMode(m);
  }

  function loadSpotify() {
    const url = toSpotifyEmbed(spotifyInput.trim());
    if (url) { setEmbedUrl(url); setShowInput(false); }
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-1">

      {/* Spotify embed */}
      {mode === 'spotify' && embedUrl && showPlayer && (
        <div className="rounded-xl overflow-hidden shadow-2xl border border-[#1a2840]">
          <iframe
            src={embedUrl}
            width="300"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            style={{ display: 'block' }}
          />
        </div>
      )}

      {/* Spotify URL input */}
      {mode === 'spotify' && showInput && (
        <div className="flex gap-2 bg-[#0b1120] border border-[#1a2840] rounded-lg px-3 py-2 w-[300px]">
          <input
            autoFocus
            value={spotifyInput}
            onChange={e => setSpotifyInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') loadSpotify(); if (e.key === 'Escape') setShowInput(false); }}
            placeholder="Paste Spotify playlist/album URL…"
            className="flex-1 bg-transparent text-xs font-mono text-white placeholder-gray-600 outline-none"
          />
          <button onClick={loadSpotify} className="text-xs font-mono text-[#1DB954] hover:text-white transition-colors shrink-0">Load</button>
        </div>
      )}

      {/* Main control bar */}
      <div className="flex items-center gap-2 bg-[#0b1120] border border-[#1a2840] rounded-lg px-3 py-2">

        {/* Mode toggle */}
        <div className="flex rounded overflow-hidden border border-[#1a2840] text-[10px] font-mono">
          <button
            onClick={() => switchMode('beats')}
            className={`px-2 py-1 transition-colors ${mode==='beats' ? 'bg-[#00e5ff]/10 text-[#00e5ff]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            BEATS
          </button>
          <button
            onClick={() => switchMode('spotify')}
            className={`px-2 py-1 transition-colors ${mode==='spotify' ? 'bg-[#1DB954]/10 text-[#1DB954]' : 'text-gray-500 hover:text-gray-300'}`}
          >
            SPOTIFY
          </button>
        </div>

        {/* Built-in beats controls */}
        {mode === 'beats' && (<>
          <button onClick={() => skip(-1)} className="text-gray-400 hover:text-white transition-colors text-xs w-4 text-center">◀</button>
          <button
            onClick={toggle}
            className={`text-sm w-5 text-center font-bold transition-colors ${playing ? 'text-[#00e5ff]' : 'text-gray-400 hover:text-[#00e5ff]'}`}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button onClick={() => skip(1)} className="text-gray-400 hover:text-white transition-colors text-[10px] w-4 text-center">▶▶</button>
          <span className="text-[10px] font-mono text-[#9c6bff] w-24 truncate">{TRACKS[trackIdx].name}</span>
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={e => handleVolume(parseFloat(e.target.value))}
            className="w-14 accent-[#00e5ff] cursor-pointer"
            title="Volume"
          />
        </>)}

        {/* Spotify controls */}
        {mode === 'spotify' && (<>
          {!embedUrl ? (
            <button
              onClick={() => setShowInput(s => !s)}
              className="text-xs font-mono px-2 py-1 rounded border border-[#1DB954]/40 text-[#1DB954] hover:border-[#1DB954] transition-colors"
            >
              + Load playlist
            </button>
          ) : (
            <>
              <button
                onClick={() => setShowPlayer(s => !s)}
                className="text-xs font-mono text-[#1DB954] hover:text-white transition-colors"
              >
                {showPlayer ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={() => setShowInput(s => !s)}
                className="text-[10px] font-mono text-gray-500 hover:text-gray-300 transition-colors"
                title="Change playlist"
              >⚙</button>
            </>
          )}
          <a
            href="https://www.pandora.com"
            target="_blank" rel="noopener noreferrer"
            className="text-xs font-mono px-2 py-1 rounded border border-[#3668ff]/40 text-[#6a8fff] hover:border-[#6a8fff] transition-colors"
          >
            Pandora
          </a>
        </>)}

      </div>
    </div>
  );
}
