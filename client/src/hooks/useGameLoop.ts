import { useEffect } from 'react';
import { Direction } from '../types';

/**
 * Registers keyboard listeners (ArrowKeys + WASD) and calls `onDirection`
 * whenever a direction key is pressed.
 */
export function useGameLoop(onDirection: (dir: Direction) => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      let dir: Direction | null = null;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          dir = 'UP';
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          dir = 'DOWN';
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          dir = 'LEFT';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          dir = 'RIGHT';
          break;
      }
      if (dir) {
        e.preventDefault();
        onDirection(dir);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDirection]);
}
