import { createContext, useContext, ReactNode } from 'react';
import { useGameSocket, UseGameSocketReturn } from '../hooks/useGameSocket';

const GameSocketContext = createContext<UseGameSocketReturn | null>(null);

export function GameSocketProvider({ children }: { children: ReactNode }) {
  const socket = useGameSocket();
  return (
    <GameSocketContext.Provider value={socket}>
      {children}
    </GameSocketContext.Provider>
  );
}

export function useSocket(): UseGameSocketReturn {
  const ctx = useContext(GameSocketContext);
  if (!ctx) throw new Error('useSocket must be used inside GameSocketProvider');
  return ctx;
}
