import { useCallback, useRef, useEffect } from 'react';
import { Direction } from '../../types';

interface Props {
  onDirection: (dir: Direction) => void;
}

const BTN = 'flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0b1120ee] border-2 border-[#1a2840] text-white text-2xl font-bold active:bg-[#00e5ff22] active:border-[#00e5ff] active:shadow-[0_0_16px_#00e5ff] select-none transition-all';

export default function MobileControls({ onDirection }: Props) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Prevent page scroll during gameplay on touch devices
  useEffect(() => {
    const prevent = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, []);

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
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      onDirection(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      onDirection(dy > 0 ? 'DOWN' : 'UP');
    }
  }, [onDirection]);

  const tap = useCallback((dir: Direction) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDirection(dir);
  }, [onDirection]);

  return (
    <>
      {/* Invisible swipe capture overlay — covers the canvas */}
      <div
        className="fixed top-0 left-0 right-0 z-20 md:hidden"
        style={{ bottom: '10rem', touchAction: 'none', pointerEvents: 'auto' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* D-pad — fixed bottom, only on mobile */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 md:hidden select-none"
        style={{ touchAction: 'none' }}
      >
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 4rem)', gridTemplateRows: 'repeat(3, 4rem)' }}>
          <div />
          <button className={BTN} onTouchStart={tap('UP')}    onMouseDown={tap('UP')}>▲</button>
          <div />
          <button className={BTN} onTouchStart={tap('LEFT')}  onMouseDown={tap('LEFT')}>◀</button>
          <div className="w-16 h-16 rounded-2xl bg-[#0b1120aa] border-2 border-[#1a2840]" />
          <button className={BTN} onTouchStart={tap('RIGHT')} onMouseDown={tap('RIGHT')}>▶</button>
          <div />
          <button className={BTN} onTouchStart={tap('DOWN')}  onMouseDown={tap('DOWN')}>▼</button>
          <div />
        </div>
      </div>
    </>
  );
}
