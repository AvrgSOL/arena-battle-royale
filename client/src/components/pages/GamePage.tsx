import { useEffect, useRef, useCallback } from 'react';
import { Page } from '../../types';
import { useSocket } from '../../context/GameSocketContext';
import { useGameLoop } from '../../hooks/useGameLoop';
import { useStore } from '../../hooks/useStore';
import { formatArena, truncateAddress } from '../../lib/utils';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

const CELL  = 20;
const GRID_W = 40;
const GRID_H = 30;
const W = GRID_W * CELL; // 800
const H = GRID_H * CELL; // 600

// Map skin item IDs to the snake color they correspond to
const SKIN_COLOR_MAP: Record<string, string> = {
  skin_neon_cyan:    '#00e5ff',
  skin_toxic_green:  '#00ff88',
  skin_royal_purple: '#9c6bff',
  skin_blood_red:    '#ff4d6a',
  skin_gold:         '#ffd54f',
  skin_phantom:      '#ffffff',
};

const TRAIL_IDS = new Set([
  'trail_fire',
  'trail_rainbow',
  'trail_electric',
  'trail_ghost',
]);

interface Props {
  navigate:  (p: Page) => void;
  roomId:    string;
  addToast:  (msg: string, variant?: 'info' | 'success' | 'error') => void;
}

export default function GamePage({ navigate, addToast }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    gameState,
    gameOver,
    lobbyCountdown,
    playerId,
    playerColor,
    sendDirection,
    leaveRoom,
  } = useSocket();

  const { owned } = useStore();

  // Keyboard → direction
  const handleDirection = useCallback(
    (dir: Parameters<typeof sendDirection>[0]) => sendDirection(dir),
    [sendDirection],
  );
  useGameLoop(handleDirection);

  // Canvas draw — also runs during countdown (gameState may be null)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // During countdown before first game tick, just show the countdown
    if (!gameState && lobbyCountdown !== null) {
      ctx.fillStyle = '#050810';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#1a2840';
      ctx.lineWidth = 1;
      for (let x = 0; x <= GRID_W; x++) {
        ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke();
      }
      for (let y = 0; y <= GRID_H; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffd54f';
      ctx.font = `bold 120px "Space Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(lobbyCountdown), W / 2, H / 2);
      ctx.font = `bold 24px "Space Mono", monospace`;
      ctx.fillStyle = '#ffffff99';
      ctx.fillText('GET READY', W / 2, H / 2 + 80);
      return;
    }

    if (!gameState) return;

    const gW = gameState.gridW || GRID_W;
    const gH = gameState.gridH || GRID_H;

    // Determine which skins/trails the local player owns
    const ownedSet = new Set(owned);

    // Check if any skin matches the local player's color
    const localSkinId = Object.entries(SKIN_COLOR_MAP).find(
      ([id, color]) => ownedSet.has(id) && color === playerColor,
    )?.[0] ?? null;
    const ownsGlowSkin = localSkinId !== null;

    const ownsTrail = [...TRAIL_IDS].some(id => ownedSet.has(id));

    // Background
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#1a2840';
    ctx.lineWidth = 1;
    for (let x = 0; x <= gW; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, H);
      ctx.stroke();
    }
    for (let y = 0; y <= gH; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(W, y * CELL);
      ctx.stroke();
    }

    // Zone overlay — darken cells outside the safe zone
    if (gameState.zone) {
      const { x1, y1, x2, y2 } = gameState.zone;
      ctx.fillStyle = 'rgba(255, 30, 30, 0.18)';
      // top strip
      if (y1 > 0) ctx.fillRect(0, 0, W, y1 * CELL);
      // bottom strip
      if (y2 < gH - 1) ctx.fillRect(0, (y2 + 1) * CELL, W, H - (y2 + 1) * CELL);
      // left strip (between top/bottom)
      if (x1 > 0) ctx.fillRect(0, y1 * CELL, x1 * CELL, (y2 - y1 + 1) * CELL);
      // right strip
      if (x2 < gW - 1) ctx.fillRect((x2 + 1) * CELL, y1 * CELL, W - (x2 + 1) * CELL, (y2 - y1 + 1) * CELL);
      // Zone border — pulsing orange
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
      ctx.strokeStyle = `rgba(255, 120, 0, ${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1 * CELL, y1 * CELL, (x2 - x1 + 1) * CELL, (y2 - y1 + 1) * CELL);
    }

    // Obstacles — red-tinted blockers
    if (gameState.obstacles?.length) {
      ctx.fillStyle = '#ff4d6a33';
      ctx.strokeStyle = '#ff4d6a88';
      ctx.lineWidth = 1;
      gameState.obstacles.forEach(o => {
        ctx.fillRect(o.x * CELL + 1, o.y * CELL + 1, CELL - 2, CELL - 2);
        ctx.strokeRect(o.x * CELL + 1, o.y * CELL + 1, CELL - 2, CELL - 2);
      });
    }

    // Power-ups
    gameState.powerUps?.forEach(pu => {
      const cx = pu.pos.x * CELL + CELL / 2;
      const cy = pu.pos.y * CELL + CELL / 2;
      if (pu.kind === 'speed') {
        // ⚡ yellow lightning
        ctx.fillStyle = '#ffd54f';
        ctx.shadowColor = '#ffd54f';
        ctx.shadowBlur = 10;
        ctx.font = `bold ${CELL - 2}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', cx, cy);
        ctx.shadowBlur = 0;
      } else if (pu.kind === 'trim') {
        // ✂️ pink scissors
        ctx.fillStyle = '#f472b6';
        ctx.shadowColor = '#f472b6';
        ctx.shadowBlur = 10;
        ctx.font = `bold ${CELL - 2}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✂', cx, cy);
        ctx.shadowBlur = 0;
      }
    });

    // Food — cyan circles
    gameState.food.forEach(f => {
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Snakes
    gameState.snakes.forEach(snake => {
      const isLocalPlayer = snake.id === playerId;
      const applySkin     = isLocalPlayer && ownsGlowSkin;
      const applyTrail    = isLocalPlayer && ownsTrail;

      ctx.fillStyle = snake.alive ? snake.color : snake.color + '44';

      const trailLen = applyTrail ? 5 : 1;

      snake.body.forEach((seg, i) => {
        if (i < trailLen) {
          // Trail segment with fading alpha
          ctx.globalAlpha = i === 0 ? 1.0 : 1.0 - (i * 0.18);
        } else {
          ctx.globalAlpha = 1.0;
        }

        // Glow for owned skin
        if (applySkin) {
          ctx.shadowColor = snake.color;
          ctx.shadowBlur  = 8;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
      });

      // Reset state after each snake
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur  = 0;
    });

    // Countdown overlay
    if (gameState.status === 'countdown' && lobbyCountdown !== null) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffd54f';
      ctx.font = `bold 120px "Space Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(lobbyCountdown), W / 2, H / 2);
    }
  }, [gameState, lobbyCountdown, owned, playerColor, playerId]);

  const handleLeave = useCallback(() => {
    leaveRoom();
    navigate({ name: 'lobby' });
  }, [leaveRoom, navigate]);

  const aliveCount = gameState?.snakes.filter(s => s.alive).length ?? 0;
  const mySnake    = gameState?.snakes.find(s => s.id === playerId);

  return (
    <div className="min-h-full bg-[#050810] flex flex-col items-center py-4 px-2">
      {/* HUD */}
      <div className="w-full max-w-[900px] flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-4 font-mono text-xs text-gray-400">
          <span>TICK <span className="text-[#00e5ff]">{gameState?.tick ?? 0}</span></span>
          <span>ALIVE <span className="text-[#00ff88]">{aliveCount}</span></span>
          {mySnake && (
            <span>
              SCORE{' '}
              <span className="text-[#ffd54f]">{mySnake.score}</span>
            </span>
          )}
          {playerColor && (
            <span className="flex items-center gap-1">
              YOU
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: playerColor }} />
            </span>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={handleLeave}>
          LEAVE
        </Button>
      </div>

      {/* Canvas + sidebar */}
      <div className="flex gap-4 items-start">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="rounded-lg border border-[#1a2840]"
          tabIndex={0}
        />

        {/* Player list */}
        <div className="w-44 bg-[#0b1120] border border-[#1a2840] rounded-lg p-3 flex flex-col gap-2">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Players</div>
          {gameState?.snakes.map(snake => (
            <div key={snake.id} className={`flex items-center justify-between gap-2 ${!snake.alive ? 'opacity-40' : ''}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: snake.color }} />
                <span className={`text-xs font-mono truncate ${snake.id === playerId ? 'text-[#00ff88]' : 'text-white'}`}>
                  {snake.name}
                </span>
              </div>
              <span className="text-xs font-mono text-[#ffd54f] shrink-0">{snake.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Game Over Modal */}
      {gameOver && (
        <Modal title="GAME OVER" onClose={handleLeave}>
          <div className="flex flex-col items-center gap-4 py-2">
            {gameOver.winnerName ? (
              <>
                <div className="text-xs text-gray-400 font-mono uppercase tracking-widest">Winner</div>
                <div className="text-2xl font-bold text-[#ffd54f] font-mono">{gameOver.winnerName}</div>
              </>
            ) : (
              <div className="text-lg font-bold text-gray-400 font-mono">No winner</div>
            )}
            <div className="flex gap-6 mt-2">
              <div className="text-center">
                <div className="text-lg font-bold text-[#00ff88] font-mono">{formatArena(gameOver.pot)}</div>
                <div className="text-xs text-gray-500 font-mono">Prize Pot</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-[#ff4d6a] font-mono">{formatArena(gameOver.burned)}</div>
                <div className="text-xs text-gray-500 font-mono">Burned (5%)</div>
              </div>
            </div>
            <Button variant="primary" onClick={handleLeave} className="mt-2 w-full">
              BACK TO LOBBY
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
