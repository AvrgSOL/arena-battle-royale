import { useState, useCallback, useEffect } from 'react';
import { Page } from './types';
import Header from './components/layout/Header';
import TokenStatsBar from './components/ui/TokenStatsBar';
import LandingPage from './components/pages/LandingPage';
import LobbyPage from './components/pages/LobbyPage';
import GamePage from './components/pages/GamePage';
import SpectatePage from './components/pages/SpectatePage';
import LeaderboardPage from './components/pages/LeaderboardPage';
import StorePage from './components/pages/StorePage';
import SoloPage from './components/pages/SoloPage';
import { GameSocketProvider } from './context/GameSocketContext';
import AudioPlayer from './components/ui/AudioPlayer';
import ChatPanel from './components/ui/ChatPanel';

interface Toast {
  id: number;
  message: string;
  variant: 'info' | 'success' | 'error';
}

let _toastId = 0;

export function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`
            px-4 py-3 rounded-lg text-sm font-mono border pointer-events-auto cursor-pointer
            ${t.variant === 'error'   ? 'bg-[#1a0a10] border-[#ff4d6a] text-[#ff4d6a]' : ''}
            ${t.variant === 'success' ? 'bg-[#0a1a10] border-[#00ff88] text-[#00ff88]' : ''}
            ${t.variant === 'info'    ? 'bg-[#0b1120] border-[#1a2840] text-white'      : ''}
          `}
          onClick={() => onRemove(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>({ name: 'landing' });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [inviteRoomId, setInviteRoomId] = useState<string | null>(null);

  const navigate = useCallback((p: Page) => setPage(p), []);

  // If opened via invite link (?join=<roomId>), go straight to lobby
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId) {
      window.history.replaceState({}, '', window.location.pathname);
      setInviteRoomId(joinId);
      setPage({ name: 'lobby' });
    }
  }, []);

  const addToast = useCallback((message: string, variant: Toast['variant'] = 'info') => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <div className="min-h-screen bg-[#050810] flex flex-col">
      <Header onNavigate={(p) => navigate({ name: p } as Page)} />

      {import.meta.env.VITE_ARENA_MINT && <TokenStatsBar />}

      <main className="flex-1 overflow-hidden">
        <GameSocketProvider>
          {page.name === 'landing'     && <LandingPage    navigate={navigate} />}
          {page.name === 'lobby'       && <LobbyPage      navigate={navigate} addToast={addToast} inviteRoomId={inviteRoomId} />}
          {page.name === 'game'        && <GamePage       navigate={navigate} roomId={page.roomId} addToast={addToast} />}
          {page.name === 'spectate'    && <SpectatePage   navigate={navigate} roomId={page.roomId} />}
          {page.name === 'leaderboard' && <LeaderboardPage navigate={navigate} />}
          {page.name === 'store'       && <StorePage      navigate={navigate} addToast={addToast} />}
          {page.name === 'solo'        && <SoloPage       navigate={navigate} />}
          <ChatPanel />
        </GameSocketProvider>
      </main>

      <AudioPlayer />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
