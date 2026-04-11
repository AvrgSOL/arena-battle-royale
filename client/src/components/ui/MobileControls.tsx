import { useCallback, useRef } from 'react';
import { Direction } from '../../types';

interface Props {
  onDirection: (dir: Direction) => void;
}

const BTN = 'flex items-center justify-center w-14 h-14 rounded-xl bg-[#0b1120cc] border border-[#1a2840] text-white text-2xl active:bg-[#00e5ff22] active:border-[#00e5ff] active:shadow-[0_0_12px_#00e5ff] select-none touch-none transition-all';

export default function MobileControls({ onDirection }: Props) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < 10 && absDy < 10) return; // too small, ignore
    if (absDx > absDy) {
      onDirection(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      onDirection(dy > 0 ? 'DOWN' : 'UP');
    }
  }, [onDirection]);

  const tap = useCallback((dir: Direction) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    onDirection(dir);
  }, [onDirection]);

  return (
    <>
      {/* Swipe capture layer — invisible overlay on the canvas area */}
      <div
        className="fixed inset-0 z-20 pointer-events-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none', pointerEvents: 'none' }}
      />

      {/* D-pad — fixed bottom center, only shown on touch screens */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 grid grid-cols-3 gap-2 md:hidden">
        {/* Row 1 */}
        <div />
        <button className={BTN} onTouchStart={tap('UP')} onMouseDown={tap('UP')}>▲</button>
        <div />
        {/* Row 2 */}
        <button className={BTN} onTouchStart={tap('LEFT')} onMouseDown={tap('LEFT')}>◀</button>
        <div className="w-14 h-14" />
        <button className={BTN} onTouchStart={tap('RIGHT')} onMouseDown={tap('RIGHT')}>▶</button>
        {/* Row 3 */}
        <div />
        <button className={BTN} onTouchStart={tap('DOWN')} onMouseDown={tap('DOWN')}>▼</button>
        <div />
      </div>
    </>
  );
}
