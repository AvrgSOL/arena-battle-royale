import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Page } from '../../types';
import Button from '../ui/Button';
import { useReferral } from '../../hooks/useReferral';
import { startMusic, stopMusic, setMuted, isMuted } from '../../lib/audio';

interface Props {
  navigate: (p: Page) => void;
}

export default function LandingPage({ navigate }: Props) {
  const { publicKey }       = useWallet();
  const { getReferralLink } = useReferral();
  const [copied, setCopied] = useState(false);
  const [muted, setMutedState] = useState(isMuted());

  // Start landing music on first click (browser autoplay policy)
  useEffect(() => {
    const start = () => { startMusic('landing'); document.removeEventListener('click', start); };
    document.addEventListener('click', start);
    return () => { stopMusic(); document.removeEventListener('click', start); };
  }, []);

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  }

  function handleCopy() {
    navigator.clipboard.writeText(getReferralLink()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative min-h-full flex flex-col items-center justify-center overflow-hidden px-4 py-16">
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(#1a2840 1px, transparent 1px), linear-gradient(90deg, #1a2840 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Glow blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#00e5ff]/5 blur-3xl pointer-events-none" />

      {/* Mute button */}
      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 z-20 text-lg px-3 py-1 rounded border border-[#1a2840] bg-[#0b1120] text-gray-400 hover:text-white hover:border-[#00e5ff] transition-colors font-mono text-xs"
      >
        {muted ? '🔇 MUTED' : '🔊 MUSIC'}
      </button>

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <p className="text-xs font-mono tracking-[0.4em] text-[#9c6bff] uppercase">
          Solana Battle Royale
        </p>

        <h1
          className="text-6xl sm:text-8xl font-extrabold tracking-[0.15em] text-[#00e5ff] glow-cyan"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          ARENA
        </h1>

        <p className="text-sm text-gray-400 font-mono max-w-sm">
          Last snake standing wins the pot.<br />
          Entry fees auto-distributed on-chain.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Button
            size="lg"
            variant="primary"
            onClick={() => navigate({ name: 'lobby' })}
          >
            ENTER BATTLE ROYALE
          </Button>
          <Button
            size="lg"
            variant="primary"
            onClick={() => navigate({ name: 'solo' })}
            className="bg-[#9c6bff]/20 border-[#9c6bff] text-[#9c6bff] hover:bg-[#9c6bff]/30"
          >
            SOLO SURVIVAL
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => navigate({ name: 'leaderboard' })}
          >
            LEADERBOARD
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => navigate({ name: 'store' })}
          >
            STORE
          </Button>
        </div>

        {/* Stats strip */}
        <div className="flex gap-8 mt-10 text-center">
          {[
            { label: 'Grid Size', value: '40×30' },
            { label: 'Tick Rate', value: '150ms' },
            { label: 'Max Players', value: '8' },
          ].map(s => (
            <div key={s.label}>
              <div className="text-lg font-bold text-[#00e5ff] font-mono">{s.value}</div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Refer & Earn */}
        {publicKey && (
          <div className="mt-10 w-full max-w-md border border-[#1a2840] rounded-lg bg-[#080d1a] px-5 py-4 text-left">
            <p className="text-xs font-mono tracking-widest text-[#9c6bff] uppercase mb-1">
              Refer &amp; Earn
            </p>
            <p className="text-sm text-gray-400 font-mono mb-3">
              Refer a friend → you both earn 500 ARENA when they play their first game
            </p>
            <div className="flex gap-2 items-center">
              <input
                readOnly
                value={getReferralLink()}
                className="flex-1 min-w-0 text-xs font-mono bg-[#0b1120] border border-[#1a2840] rounded px-3 py-2 text-[#00e5ff] truncate outline-none"
              />
              <button
                onClick={handleCopy}
                className={`
                  shrink-0 text-xs font-mono px-3 py-2 rounded border transition-colors
                  ${copied
                    ? 'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88]'
                    : 'bg-[#0b1120] border-[#1a2840] text-white hover:border-[#9c6bff] hover:text-[#9c6bff]'
                  }
                `}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
