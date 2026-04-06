import { useEffect, useRef, useCallback, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Page } from '../../types';
import { useSoloGame, SOLO_W, SOLO_H, SoloPowerUpType } from '../../hooks/useSoloGame';
import { useGameLoop } from '../../hooks/useGameLoop';
import { buildEntryPaymentTx, isArenaConfigured, ARENA_DECIMALS } from '../../lib/token';
import { playSfx } from '../../lib/audio';
import Button from '../ui/Button';

const CELL = 20;
const W    = SOLO_W * CELL; // 800
const H    = SOLO_H * CELL; // 600

const ENTRY_FEE_BASE = 10 * 10 ** ARENA_DECIMALS; // 10 ARENA

const SERVER_HTTP = import.meta.env.VITE_API_URL ??
  ((import.meta.env.VITE_WS_URL as string ?? 'ws://localhost:3002')
    .replace(/^wss:\/\//, 'https://')
    .replace(/^ws:\/\//, 'http://'));

const POWERUP_LABEL: Record<SoloPowerUpType, string> = {
  freeze: '❄️ FREEZE',
  shield: '🛡️ SHIELD',
  bomb:   '💣 BOMB',
  star:   '⭐ 2× SCORE',
};

const POWERUP_COLOR: Record<SoloPowerUpType, string> = {
  freeze: '#00e5ff',
  shield: '#9c6bff',
  bomb:   '#ff4d6a',
  star:   '#ffd54f',
};

interface LeaderboardData {
  entries: { wallet: string; name: string; score: number }[];
  pool:    number;
  prizes:  number[];
  week:    { week: number; year: number };
}

interface Props {
  navigate: (p: Page) => void;
}

type Mode = 'practice' | 'challenge';

export default function SoloPage({ navigate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, start, setDirection } = useSoloGame();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [mode, setMode]             = useState<Mode>('practice');
  const [pickupFlash, setPickupFlash] = useState<string | null>(null);
  const [levelFlash, setLevelFlash]   = useState(false);
  const [countdown, setCountdown]     = useState<number | null>(null);
  // Particles: [x, y, vx, vy, life, color]
  const particlesRef = useRef<[number,number,number,number,number,string][]>([]);
  const animFrameRef = useRef<number | null>(null);
  const [paying, setPaying]           = useState(false);
  const [payError, setPayError]       = useState<string | null>(null);
  const [txSigRef]                    = useState<{ current: string | null }>({ current: null });
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [displayName, setDisplayName] = useState('');

  // Keyboard → direction
  const handleDirection = useCallback(
    (dir: Parameters<typeof setDirection>[0]) => setDirection(dir),
    [setDirection],
  );
  useGameLoop(handleDirection);


  // Fetch leaderboard on mount and after score submit
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_HTTP}/api/solo/leaderboard`);
      if (res.ok) setLeaderboard(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // 5-second countdown
  const beginCountdown = useCallback(() => {
    setCountdown(5);
    setScoreSubmitted(false);
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { setCountdown(null); start(); return; }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, start]);

  // Submit score after challenge game ends
  useEffect(() => {
    if (state.alive || !state.started || mode !== 'challenge') return;
    if (scoreSubmitted || !txSigRef.current || !publicKey) return;

    const sig = txSigRef.current;
    const name = displayName.trim() || publicKey.toBase58().slice(0, 8);
    setScoreSubmitted(true);

    fetch(`${SERVER_HTTP}/api/solo/score`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ wallet: publicKey.toBase58(), name, score: state.score, txSig: sig }),
    })
      .then(r => r.json())
      .then(data => { if (data.leaderboard) setLeaderboard(prev => prev ? { ...prev, entries: data.leaderboard } : prev); })
      .catch(() => {});
  }, [state.alive, state.started, state.score, mode, scoreSubmitted, txSigRef, publicKey, displayName]);

  // Pay & start challenge
  const handleChallengeStart = useCallback(async () => {
    if (!publicKey) { setPayError('Connect your wallet first'); return; }
    if (!isArenaConfigured()) {
      // Dev mode: skip payment
      txSigRef.current = 'dev_' + Date.now();
      beginCountdown();
      return;
    }
    setPayError(null);
    setPaying(true);
    try {
      const tx  = await buildEntryPaymentTx(connection, publicKey, ENTRY_FEE_BASE);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');
      txSigRef.current = sig;
      beginCountdown();
    } catch (e: any) {
      setPayError(e?.message?.includes('rejected') ? 'Transaction cancelled' : 'Payment failed — try again');
    } finally {
      setPaying(false);
    }
  }, [publicKey, connection, sendTransaction, beginCountdown, txSigRef]);

  // Eat SFX + particles
  const prevScoreRef = useRef(0);
  useEffect(() => {
    if (!state.alive) return;
    if (state.score > prevScoreRef.current) {
      playSfx('eat');
      // Spawn particles at snake head
      const head = state.snake[0];
      if (head) {
        const cx = head.x * CELL + CELL / 2;
        const cy = head.y * CELL + CELL / 2;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const speed = 1.5 + Math.random() * 2;
          particlesRef.current.push([cx, cy, Math.cos(angle)*speed, Math.sin(angle)*speed, 1.0, '#00e5ff']);
        }
      }
    }
    prevScoreRef.current = state.score;
  }, [state.score, state.alive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pickup flash + SFX
  useEffect(() => {
    if (!state.lastPickup) return;
    setPickupFlash(POWERUP_LABEL[state.lastPickup]);
    playSfx(state.lastPickup === 'freeze' ? 'freeze' : state.lastPickup === 'shield' ? 'shield' : state.lastPickup === 'bomb' ? 'bomb' : 'powerUp');
    const t = setTimeout(() => setPickupFlash(null), 1200);
    return () => clearTimeout(t);
  }, [state.tick, state.lastPickup]); // eslint-disable-line react-hooks/exhaustive-deps

  // Level-up flash + SFX
  useEffect(() => {
    if (!state.levelUpFlash) return;
    setLevelFlash(true);
    playSfx('levelUp');
    const t = setTimeout(() => setLevelFlash(false), 600);
    return () => clearTimeout(t);
  }, [state.level]); // eslint-disable-line react-hooks/exhaustive-deps

  // Game over SFX
  const prevAliveRef = useRef(true);
  useEffect(() => {
    if (prevAliveRef.current && !state.alive && state.started) playSfx('gameOver');
    prevAliveRef.current = state.alive;
  }, [state.alive, state.started]);

  // Canvas render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#1a2840';
    ctx.lineWidth = 1;
    for (let x = 0; x <= SOLO_W; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke();
    }
    for (let y = 0; y <= SOLO_H; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke();
    }

    if (!state.started) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#00e5ff';
      ctx.font = `bold 56px "Space Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SOLO SURVIVAL', W / 2, H / 2 - 60);
      ctx.font = `18px "Space Mono", monospace`;
      ctx.fillStyle = '#ffffff88';
      ctx.fillText('Survive as long as possible', W / 2, H / 2);
      ctx.fillText('Collect power-ups to fight back', W / 2, H / 2 + 36);
      ctx.fillStyle = '#ffd54f';
      ctx.font = `bold 20px "Space Mono", monospace`;
      ctx.fillText('Select a mode and press START', W / 2, H / 2 + 90);
      return;
    }

    // Obstacles
    if (state.obstacles.length) {
      ctx.fillStyle = '#ff4d6a33';
      ctx.strokeStyle = '#ff4d6a88';
      ctx.lineWidth = 1;
      state.obstacles.forEach(o => {
        ctx.fillRect(o.x * CELL + 1, o.y * CELL + 1, CELL - 2, CELL - 2);
        ctx.strokeRect(o.x * CELL + 1, o.y * CELL + 1, CELL - 2, CELL - 2);
      });
    }

    // Food
    state.food.forEach(f => {
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Power-ups
    state.powerUps.forEach(pu => {
      const cx = pu.pos.x * CELL + CELL / 2;
      const cy = pu.pos.y * CELL + CELL / 2;
      const emoji = pu.kind === 'freeze' ? '❄️' : pu.kind === 'shield' ? '🛡️' : pu.kind === 'bomb' ? '💣' : '⭐';
      ctx.shadowColor = POWERUP_COLOR[pu.kind];
      ctx.shadowBlur = 12;
      ctx.font = `bold ${CELL - 2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, cx, cy);
      ctx.shadowBlur = 0;
    });

    // Hunters
    state.hunters.forEach(h => {
      const frozen = state.effects.freezeTicks > 0;
      const color  = frozen ? '#88ccff' : '#ff4d6a';
      ctx.fillStyle   = color + '55';
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur  = frozen ? 4 : 10;
      ctx.fillRect(h.pos.x * CELL + 2, h.pos.y * CELL + 2, CELL - 4, CELL - 4);
      ctx.strokeRect(h.pos.x * CELL + 2, h.pos.y * CELL + 2, CELL - 4, CELL - 4);
      ctx.shadowBlur = 0;
    });

    // Snake
    const shieldColor = '#9c6bff';
    const snakeColor  = state.effects.shieldActive ? shieldColor : '#00ff88';
    state.snake.forEach((seg, i) => {
      ctx.globalAlpha = i === 0 ? 1.0 : Math.max(0.25, 1.0 - i * 0.04);
      ctx.fillStyle   = snakeColor;
      if (state.effects.shieldActive) { ctx.shadowColor = shieldColor; ctx.shadowBlur = 10; }
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur  = 0;

    if (levelFlash) { ctx.fillStyle = 'rgba(255,213,79,0.12)'; ctx.fillRect(0, 0, W, H); }

    if (state.effects.starTicks > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 120);
      ctx.strokeStyle = `rgba(255,213,79,${0.5 + pulse * 0.5})`; ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - 4);
    }
    if (state.effects.freezeTicks > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 100);
      ctx.strokeStyle = `rgba(0,229,255,${0.4 + pulse * 0.5})`; ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - 4);
    }

    if (!state.alive && state.started) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ff4d6a';
      ctx.font = `bold 64px "Space Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 40);
      ctx.font = `bold 24px "Space Mono", monospace`;
      ctx.fillStyle = '#ffd54f';
      ctx.fillText(`Score: ${state.score}`, W / 2, H / 2 + 20);
      if (state.score >= state.highScore && state.score > 0) {
        ctx.fillStyle = '#00ff88';
        ctx.font = `bold 18px "Space Mono", monospace`;
        ctx.fillText('🏆 NEW HIGH SCORE!', W / 2, H / 2 + 60);
      }
      ctx.fillStyle = '#ffffff66';
      ctx.font = `14px "Space Mono", monospace`;
      ctx.fillText('Select a mode and press START to play again', W / 2, H / 2 + 100);
    }

    // Particles
    particlesRef.current = particlesRef.current
      .map(([x, y, vx, vy, life, color]) => [x + vx, y + vy, vx * 0.9, vy * 0.9, life - 0.08, color] as [number,number,number,number,number,string])
      .filter(([,,,, life]) => life > 0);
    particlesRef.current.forEach(([x, y,,, life, color]) => {
      ctx.globalAlpha = life;
      ctx.fillStyle = color;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
  }, [state, levelFlash, countdown]);

  // Countdown overlay
  useEffect(() => {
    if (countdown === null) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd54f';
    ctx.font = `bold 160px "Space Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(countdown), W / 2, H / 2);
    ctx.font = `bold 24px "Space Mono", monospace`;
    ctx.fillStyle = '#ffffff88';
    ctx.fillText('GET READY', W / 2, H / 2 + 100);
  }, [countdown]);

  // Space bar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' && !state.alive && countdown === null && !paying) {
        e.preventDefault();
        if (mode === 'challenge') handleChallengeStart();
        else beginCountdown();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.alive, countdown, paying, mode, beginCountdown, handleChallengeStart]);

  const isStar   = state.effects.starTicks > 0;
  const isFreeze = state.effects.freezeTicks > 0;
  const isShield = state.effects.shieldActive;
  const poolArena = leaderboard ? (leaderboard.pool / 10 ** ARENA_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';

  return (
    <div className="min-h-full bg-[#050810] flex flex-col items-center py-4 px-2">

      {/* Mode selector */}
      {!state.alive && (
        <div className="w-full max-w-[820px] mb-4 flex flex-col sm:flex-row gap-3 px-1">
          {/* Practice */}
          <button
            onClick={() => setMode('practice')}
            className={`flex-1 rounded-lg border p-4 text-left transition-colors ${
              mode === 'practice'
                ? 'border-[#00ff88] bg-[#00ff88]/10'
                : 'border-[#1a2840] bg-[#0b1120] hover:border-[#00ff88]/50'
            }`}
          >
            <div className="text-sm font-mono font-bold text-[#00ff88]">FREE PRACTICE</div>
            <div className="text-xs font-mono text-gray-400 mt-1">No entry fee · Local high score only</div>
          </button>

          {/* Weekly Challenge */}
          <button
            onClick={() => setMode('challenge')}
            className={`flex-1 rounded-lg border p-4 text-left transition-colors ${
              mode === 'challenge'
                ? 'border-[#ffd54f] bg-[#ffd54f]/10'
                : 'border-[#1a2840] bg-[#0b1120] hover:border-[#ffd54f]/50'
            }`}
          >
            <div className="text-sm font-mono font-bold text-[#ffd54f]">🏆 WEEKLY CHALLENGE</div>
            <div className="text-xs font-mono text-gray-400 mt-1">
              10 ARENA entry · Score on global leaderboard
            </div>
            <div className="text-xs font-mono text-[#9c6bff] mt-1">
              Prize pool: <span className="font-bold">{poolArena} ARENA</span> · Top 3 win 50/30/20%
            </div>
          </button>
        </div>
      )}

      {/* Display name (challenge mode only) */}
      {mode === 'challenge' && !state.alive && (
        <div className="w-full max-w-[820px] mb-3 px-1">
          <input
            type="text"
            maxLength={20}
            placeholder="Your display name (optional)"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full sm:w-64 text-xs font-mono bg-[#0b1120] border border-[#1a2840] rounded px-3 py-2 text-white outline-none focus:border-[#ffd54f]"
          />
        </div>
      )}

      {/* HUD */}
      <div className="w-full max-w-[820px] flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-4 font-mono text-xs text-gray-400 flex-wrap">
          <span>LVL <span className="text-[#9c6bff] font-bold">{state.level}</span></span>
          <span>SCORE <span className="text-[#ffd54f]">{state.score}</span></span>
          <span>BEST <span className="text-[#00ff88]">{state.highScore}</span></span>
          <span>HUNTERS <span className="text-[#ff4d6a]">{state.hunters.length}</span></span>
          {isFreeze && <span className="px-2 py-0.5 rounded border border-[#00e5ff] text-[#00e5ff] text-[10px] animate-pulse">❄️ {state.effects.freezeTicks}t</span>}
          {isShield && <span className="px-2 py-0.5 rounded border border-[#9c6bff] text-[#9c6bff] text-[10px]">🛡️ SHIELDED</span>}
          {isStar   && <span className="px-2 py-0.5 rounded border border-[#ffd54f] text-[#ffd54f] text-[10px] animate-pulse">⭐ 2× {state.effects.starTicks}t</span>}
        </div>

        <div className="flex items-center gap-2">
          {!state.alive && countdown === null && (
            mode === 'challenge' ? (
              <Button size="sm" variant="primary" onClick={handleChallengeStart} disabled={paying}>
                {paying ? 'PAYING...' : state.started ? '▶ PLAY AGAIN (10 ARENA)' : '▶ START (10 ARENA)'}
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={beginCountdown}>
                {state.started ? '▶ PLAY AGAIN' : '▶ START'}
              </Button>
            )
          )}
          {countdown !== null && (
            <span className="text-sm font-mono font-bold text-[#ffd54f] px-2">Starting in {countdown}...</span>
          )}
          <Button size="sm" variant="ghost" onClick={() => navigate({ name: 'landing' })}>EXIT</Button>
        </div>
      </div>

      {payError && (
        <div className="w-full max-w-[820px] mb-2 px-1 text-xs font-mono text-[#ff4d6a]">{payError}</div>
      )}

      {pickupFlash && (
        <div className="mb-2 px-4 py-1 rounded-full text-sm font-mono font-bold border border-[#ffd54f] text-[#ffd54f] bg-[#ffd54f]/10 animate-bounce">
          {pickupFlash}
        </div>
      )}
      {!pickupFlash && <div className="mb-2 h-7" />}

      {/* Canvas + Leaderboard side by side */}
      <div className="flex gap-4 items-start">
        <canvas ref={canvasRef} width={W} height={H} className="rounded-lg border border-[#1a2840]" tabIndex={0} />

        {/* Weekly leaderboard panel */}
        <div className="w-52 shrink-0 bg-[#0b1120] border border-[#1a2840] rounded-lg p-3 flex flex-col gap-2">
          <div className="text-xs font-mono text-[#ffd54f] uppercase tracking-widest">🏆 Weekly Top 10</div>
          <div className="text-[10px] font-mono text-[#9c6bff]">Prize pool: {poolArena} ARENA</div>
          {leaderboard?.prizes && leaderboard.prizes.length > 0 && (
            <div className="text-[10px] font-mono text-gray-500 flex gap-2">
              {leaderboard.prizes.map((p, i) => (
                <span key={i}>#{i + 1}: {(p / 10 ** ARENA_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              ))}
            </div>
          )}
          <div className="border-t border-[#1a2840] pt-2 flex flex-col gap-1">
            {!leaderboard?.entries?.length && (
              <div className="text-[10px] font-mono text-gray-600">No scores yet this week</div>
            )}
            {leaderboard?.entries?.map((e, i) => (
              <div key={e.wallet + i} className="flex items-center justify-between gap-1">
                <span className={`text-[10px] font-mono ${i === 0 ? 'text-[#ffd54f]' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-[#cd7f32]' : 'text-gray-500'}`}>
                  #{i + 1} {e.name.length > 8 ? e.name.slice(0, 8) + '…' : e.name}
                </span>
                <span className="text-[10px] font-mono text-[#00ff88] shrink-0">{e.score}</span>
              </div>
            ))}
          </div>
          <button onClick={fetchLeaderboard} className="text-[10px] font-mono text-gray-600 hover:text-gray-400 text-left mt-1">↻ refresh</button>
        </div>
      </div>

      {/* Power-up legend */}
      <div className="mt-4 flex gap-4 flex-wrap justify-center">
        {(['freeze', 'shield', 'bomb', 'star'] as SoloPowerUpType[]).map(kind => (
          <div key={kind} className="flex items-center gap-1.5 text-xs font-mono text-gray-500">
            <span>{kind === 'freeze' ? '❄️' : kind === 'shield' ? '🛡️' : kind === 'bomb' ? '💣' : '⭐'}</span>
            <span style={{ color: POWERUP_COLOR[kind] }}>
              {kind === 'freeze' ? 'Freeze hunters' : kind === 'shield' ? 'One free hit' : kind === 'bomb' ? 'Blast hunters' : '2× score'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
