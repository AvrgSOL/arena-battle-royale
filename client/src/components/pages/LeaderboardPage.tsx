import { Page } from '../../types';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { formatSOL, truncateAddress } from '../../lib/utils';
import Button from '../ui/Button';

interface Props {
  navigate: (p: Page) => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['text-[#ffd54f]', 'text-gray-300', 'text-[#fb923c]'];

export default function LeaderboardPage({ navigate }: Props) {
  const { leaders, loading } = useLeaderboard();

  return (
    <div className="min-h-full bg-[#050810] px-4 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ name: 'landing' })}
          className="text-gray-500 hover:text-white font-mono text-sm transition-colors"
        >
          ← BACK
        </button>
        <h2
          className="text-xl font-extrabold tracking-widest text-[#ffd54f]"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          LEADERBOARD
        </h2>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 font-mono py-20">Loading…</div>
      ) : leaders.length === 0 ? (
        <div className="text-center text-gray-500 font-mono py-20">No data yet. Play a game first!</div>
      ) : (
        <div className="bg-[#0b1120] border border-[#1a2840] rounded-lg overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[3rem_1fr_6rem_9rem_7rem] gap-0 border-b border-[#1a2840] px-4 py-3">
            {['RANK', 'PLAYER', 'WINS', 'EARNED', 'GAMES'].map(h => (
              <div key={h} className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                {h}
              </div>
            ))}
          </div>

          {leaders.map((entry, idx) => (
            <div
              key={entry.wallet}
              className={`grid grid-cols-[3rem_1fr_6rem_9rem_7rem] gap-0 px-4 py-3 border-b border-[#1a2840]/50 last:border-0
                ${idx === 0 ? 'bg-[#ffd54f]/5' : ''}
                ${idx === 1 ? 'bg-gray-500/5'  : ''}
                ${idx === 2 ? 'bg-[#fb923c]/5' : ''}
                hover:bg-white/[0.02] transition-colors
              `}
            >
              {/* Rank */}
              <div className={`font-mono font-bold text-sm ${idx < 3 ? RANK_COLORS[idx] : 'text-gray-600'}`}>
                {idx < 3 ? MEDALS[idx] : `#${idx + 1}`}
              </div>

              {/* Name / wallet */}
              <div>
                <div className="font-mono text-sm text-white">{entry.name || '—'}</div>
                <div className="font-mono text-xs text-gray-600">{truncateAddress(entry.wallet)}</div>
              </div>

              {/* Wins */}
              <div className="font-mono text-sm text-[#00ff88]">{entry.wins}</div>

              {/* Earned */}
              <div className="font-mono text-sm text-[#ffd54f]">{formatSOL(entry.totalEarned)}</div>

              {/* Games */}
              <div className="font-mono text-sm text-gray-400">{entry.gamesPlayed}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 text-center">
        <Button variant="primary" onClick={() => navigate({ name: 'lobby' })}>
          PLAY NOW
        </Button>
      </div>
    </div>
  );
}
