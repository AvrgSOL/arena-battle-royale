import { useCallback, useRef, useEffect } from 'react';
import { Direction } from '../../types';

interface Props {
  onDirection: (dir: Direction) => void;
  isMobile: boolean;
}

export default function MobileControls({ onDirection, isMobile }: Props) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Prevent page scroll/zoom during gameplay on touch devices
  useEffect(() => {
    if (!isMobile) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', prevent, { passive: false });
    document.addEventListener('touchstart', prevent, { passive: false });
    return () => {
      document.removeEventListener('touchmove', prevent);
      document.removeEventListener('touchstart', prevent);
    };
  }, [isMobile]);

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

  if (!isMobile) return null;

  const btnStyle: React.CSSProperties = {
    width: 68, height: 68,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16,
    background: 'rgba(11,17,32,0.92)',
    border: '2px solid #1a2840',
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 'bold',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    cursor: 'pointer',
  };

  const emptyStyle: React.CSSProperties = { width: 68, height: 68 };

  return (
    <>
      {/* Swipe zone — top portion of screen */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          bottom: '14rem', zIndex: 20,
          touchAction: 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* D-pad */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 68px)',
        gridTemplateRows: 'repeat(3, 68px)',
        gap: 8,
        touchAction: 'none',
      }}>
        <div style={emptyStyle} />
        <button style={btnStyle} onTouchStart={tap('UP')}    onMouseDown={tap('UP')}>▲</button>
        <div style={emptyStyle} />
        <button style={btnStyle} onTouchStart={tap('LEFT')}  onMouseDown={tap('LEFT')}>◀</button>
        <div style={{ ...emptyStyle, background: 'rgba(11,17,32,0.7)', borderRadius: 16, border: '2px solid #1a2840' }} />
        <button style={btnStyle} onTouchStart={tap('RIGHT')} onMouseDown={tap('RIGHT')}>▶</button>
        <div style={emptyStyle} />
        <button style={btnStyle} onTouchStart={tap('DOWN')}  onMouseDown={tap('DOWN')}>▼</button>
        <div style={emptyStyle} />
      </div>
    </>
  );
}
