import '@solana/wallet-adapter-react-ui/styles.css';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const PUMP_URL = import.meta.env.VITE_PUMP_URL as string | undefined;

interface Props {
  onNavigate?: (page: string) => void;
}

export default function Header({ onNavigate }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[#1a2840] bg-[#0b1120]">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <span
            className="text-2xl font-extrabold tracking-[0.2em] text-[#00e5ff] glow-cyan cursor-pointer"
            style={{ fontFamily: 'Syne, sans-serif' }}
            onClick={() => onNavigate?.('landing')}
          >
            ARENA
          </span>
          <span className="text-xs text-gray-500 font-mono tracking-widest hidden sm:block">
            BATTLE ROYALE
          </span>
        </div>

        {onNavigate && (
          <nav className="hidden sm:flex items-center gap-4">
            <button
              onClick={() => onNavigate('store')}
              className="text-xs font-mono tracking-widest text-gray-400 hover:text-[#00e5ff] transition-colors uppercase"
            >
              Store
            </button>
            <button
              onClick={() => onNavigate('leaderboard')}
              className="text-xs font-mono tracking-widest text-gray-400 hover:text-[#00e5ff] transition-colors uppercase"
            >
              Leaderboard
            </button>
            {PUMP_URL && (
              <a
                href={PUMP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono tracking-widest px-3 py-1.5 rounded border border-[#00e5ff]/40 text-[#00e5ff] hover:bg-[#00e5ff]/10 transition-colors uppercase animate-pulse"
              >
                Buy ARENA
              </a>
            )}
          </nav>
        )}
      </div>
      <WalletMultiButton />
    </header>
  );
}
