import { useCallback, useRef, useEffect } from 'react';
import { Direction } from '../../types';

interface Props {
  onDirection: (dir: Direction) => void;
  isMobile: boolean;
}

export default function MobileControls({ onDirection, isMobile }: Props) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isMobile) return;
    const prevent = (e: TouchEvent) => { if ((e.target as HTMLElement)?.closest('.game-canvas-area')) e.preventDefault(); };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => document.removeEventListener('touchmove', prevent);
  }, [isMobile]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
    onDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP'));
  }, [onDirection]);

  const tap = (dir: Direction) => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    onDirection(dir);
  };

  if (!isMobile) return null;

  const btn: React.CSSProperties = {
    width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, background: 'rgba(11,17,32,0.9)', border: '2px solid #1a2840',
    color: '#fff', fontSize: 24, touchAction: 'none', userSelect: 'none',
  };

  return (
    <>
      {/* Swipe zone over the canvas */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: '13rem', zIndex: 20, touchAction: 'none' }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />

      {/* D-pad */}
      <div style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 30, display: 'grid', gap: 6,
        gridTemplateColumns: 'repeat(3, 68px)', gridTemplateRows: 'repeat(3, 68px)',
        touchAction: 'none',
      }}>
        <div /><button style={btn} onTouchStart={tap('UP')}    onMouseDown={tap('UP')}>▲</button><div />
        <button style={btn} onTouchStart={tap('LEFT')}  onMouseDown={tap('LEFT')}>◀</button>
        <div style={{ ...btn, background: 'rgba(11,17,32,0.5)' }} />
        <button style={btn} onTouchStart={tap('RIGHT')} onMouseDown={tap('RIGHT')}>▶</button>
        <div /><button style={btn} onTouchStart={tap('DOWN')}  onMouseDown={tap('DOWN')}>▼</button><div />
      </div>
    </>
  );
}
