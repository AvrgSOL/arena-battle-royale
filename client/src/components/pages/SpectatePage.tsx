import { useEffect, useRef } from 'react';
import { Page } from '../../types';
import { useSocket } from '../../context/GameSocketContext';
import Button from '../ui/Button';

const CELL   = 20;
const GRID_W = 40;
const GRID_H = 30;
const W = GRID_W * CELL;
const H = GRID_H * CELL;

interface Props {
  navigate: (p: Page) => void;
  roomId:   string;
}

export default function SpectatePage({ navigate, roomId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gameState, spectateRoom, leaveRoom } = useSocket();

  // Join as spectator
  useEffect(() => {
    if (roomId) spectateRoom(roomId);
  }, [roomId, spectateRoom]);

  // Canvas draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gW = gameState.gridW || GRID_W;
    const gH = gameState.gridH || GRID_H;

    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#1a2840';
    ctx.lineWidth = 1;
    for (let x = 0; x <= gW; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); ctx.stroke();
    }
    for (let y = 0; y <= gH; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); ctx.stroke();
    }

    gameState.food.forEach(f => {
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
      ctx.fill();
    });

    gameState.snakes.forEach(snake => {
      ctx.fillStyle = snake.alive ? snake.color : snake.color + '44';
      snake.body.forEach(seg => {
        ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
      });
    });
  }, [gameState]);

  const handleLeave = () => {
    leaveRoom();
    navigate({ name: 'lobby' });
  };

  return (
    <div className="min-h-full bg-[#050810] flex flex-col items-center py-4 px-2">
      {/* HUD */}
      <div className="w-full max-w-[900px] flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold border border-[#9c6bff]/50 text-[#9c6bff] bg-[#9c6bff]/10 tracking-widest">
            SPECTATING
          </span>
          <span className="text-xs font-mono text-gray-500">
            TICK <span className="text-[#00e5ff]">{gameState?.tick ?? 0}</span>
          </span>
          <span className="text-xs font-mono text-gray-500">
            ALIVE <span className="text-[#00ff88]">{gameState?.snakes.filter(s => s.alive).length ?? 0}</span>
          </span>
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
        />

        <div className="w-44 bg-[#0b1120] border border-[#1a2840] rounded-lg p-3 flex flex-col gap-2">
          <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-1">Players</div>
          {gameState?.snakes.map(snake => (
            <div key={snake.id} className={`flex items-center justify-between gap-2 ${!snake.alive ? 'opacity-40' : ''}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: snake.color }} />
                <span className="text-xs font-mono truncate text-white">{snake.name}</span>
              </div>
              <span className="text-xs font-mono text-[#ffd54f] shrink-0">{snake.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
