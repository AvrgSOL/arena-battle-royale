import { useEffect, useRef, useCallback, useState } from 'react';
import { Page } from '../../types';
import { useSoloGame, SOLO_W, SOLO_H, SoloPowerUpType } from '../../hooks/useSoloGame';
import { useGameLoop } from '../../hooks/useGameLoop';
import Button from '../ui/Button';

const CELL = 20;
const W    = SOLO_W * CELL; // 800
const H    = SOLO_H * CELL; // 600

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

interface Props {
  navigate: (p: Page) => void;
}

export default function SoloPage({ navigate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, start, setDirection } = useSoloGame();

  // Flash UI for pickups
  const [pickupFlash, setPickupFlash] = useState<string | null>(null);
  const [levelFlash, setLevelFlash] = useState(false);

  // Keyboard → direction (reuse game loop hook)
  const handleDirection = useCallback(
    (dir: Parameters<typeof setDirection>[0]) => setDirection(dir),
    [setDirection],
  );
  useGameLoop(handleDirection);

  // Pickup flash
  useEffect(() => {
    if (state.lastPickup) {
      setPickupFlash(POWERUP_LABEL[state.lastPickup]);
      const t = setTimeout(() => setPickupFlash(null), 1200);
      return () => clearTimeout(t);
    }
  }, [state.tick, state.lastPickup]); // eslint-disable-line react-hooks/exhaustive-deps

  // Level-up flash
  useEffect(() => {
    if (state.levelUpFlash) {
      setLevelFlash(true);
      const t = setTimeout(() => setLevelFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [state.level]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canvas render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = '#1a2840';
    ctx.lineWidth = 1;
    for (let x = 0; x <= SOLO_W; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke();
    }
    for (let y = 0; y <= SOLO_H; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke();
    }

    if (!state.started) {
      // Title screen
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
      ctx.fillText('Press SPACE or click START to begin', W / 2, H / 2 + 90);
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

    // Food — cyan circles
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
      const emoji = pu.kind === 'freeze' ? '❄️'
                  : pu.kind === 'shield' ? '🛡️'
                  : pu.kind === 'bomb'   ? '💣'
                  : '⭐';
      ctx.shadowColor = POWERUP_COLOR[pu.kind];
      ctx.shadowBlur = 12;
      ctx.font = `bold ${CELL - 2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, cx, cy);
      ctx.shadowBlur = 0;
    });

    // Hunters — glowing red squares
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
      if (state.effects.shieldActive) {
        ctx.shadowColor = shieldColor;
        ctx.shadowBlur  = 10;
      }
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur  = 0;

    // Level-up flash overlay
    if (levelFlash) {
      ctx.fillStyle = 'rgba(255, 213, 79, 0.12)';
      ctx.fillRect(0, 0, W, H);
    }

    // Star active pulsing border
    if (state.effects.starTicks > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 120);
      ctx.strokeStyle = `rgba(255, 213, 79, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - 4);
    }

    // Freeze active — cyan border pulse
    if (state.effects.freezeTicks > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 100);
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.4 + pulse * 0.5})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - 4);
    }

    // Game Over overlay
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
      ctx.fillText('Press SPACE or click PLAY AGAIN to restart', W / 2, H / 2 + 100);
    }
  }, [state, levelFlash]);

  // Space bar starts or restarts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' && (!state.alive)) {
        e.preventDefault();
        start();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.alive, start]);

  const isStar   = state.effects.starTicks > 0;
  const isFreeze = state.effects.freezeTicks > 0;
  const isShield = state.effects.shieldActive;

  return (
    <div className="min-h-full bg-[#050810] flex flex-col items-center py-4 px-2">
      {/* HUD */}
      <div className="w-full max-w-[820px] flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-4 font-mono text-xs text-gray-400 flex-wrap">
          <span>LVL <span className="text-[#9c6bff] font-bold">{state.level}</span></span>
          <span>SCORE <span className="text-[#ffd54f]">{state.score}</span></span>
          <span>BEST <span className="text-[#00ff88]">{state.highScore}</span></span>
          <span>HUNTERS <span className="text-[#ff4d6a]">{state.hunters.length}</span></span>

          {/* Active effects */}
          {isFreeze && (
            <span className="px-2 py-0.5 rounded border border-[#00e5ff] text-[#00e5ff] text-[10px] animate-pulse">
              ❄️ FROZEN {state.effects.freezeTicks}t
            </span>
          )}
          {isShield && (
            <span className="px-2 py-0.5 rounded border border-[#9c6bff] text-[#9c6bff] text-[10px]">
              🛡️ SHIELDED
            </span>
          )}
          {isStar && (
            <span className="px-2 py-0.5 rounded border border-[#ffd54f] text-[#ffd54f] text-[10px] animate-pulse">
              ⭐ 2× SCORE {state.effects.starTicks}t
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {(!state.alive) && (
            <Button size="sm" variant="primary" onClick={start}>
              {state.started ? 'PLAY AGAIN' : 'START'}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => navigate({ name: 'landing' })}>
            EXIT
          </Button>
        </div>
      </div>

      {/* Power-up pickup flash */}
      {pickupFlash && (
        <div className="mb-2 px-4 py-1 rounded-full text-sm font-mono font-bold border border-[#ffd54f] text-[#ffd54f] bg-[#ffd54f]/10 animate-bounce">
          {pickupFlash}
        </div>
      )}
      {!pickupFlash && <div className="mb-2 h-7" />}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="rounded-lg border border-[#1a2840]"
        tabIndex={0}
      />

      {/* Power-up legend */}
      <div className="mt-4 flex gap-4 flex-wrap justify-center">
        {(['freeze', 'shield', 'bomb', 'star'] as SoloPowerUpType[]).map(kind => (
          <div key={kind} className="flex items-center gap-1.5 text-xs font-mono text-gray-500">
            <span>{kind === 'freeze' ? '❄️' : kind === 'shield' ? '🛡️' : kind === 'bomb' ? '💣' : '⭐'}</span>
            <span style={{ color: POWERUP_COLOR[kind] }}>
              {kind === 'freeze' ? 'Freeze hunters'
               : kind === 'shield' ? 'One free hit'
               : kind === 'bomb'   ? 'Blast hunters'
               : '2× score'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
