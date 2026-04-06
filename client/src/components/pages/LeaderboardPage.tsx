import { useState, useEffect } from 'react';
import { Page } from '../../types';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { formatSOL, truncateAddress } from '../../lib/utils';
import Button from '../ui/Button';
import { useWallet } from '@solana/wallet-adapter-react';
import XPBadge from '../ui/XPBadge';
import ChallengePanel from '../ui/ChallengePanel';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002';

interface Props { navigate: (p: Page) => void; }

const MEDALS      = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['text-[#ffd54f]', 'text-gray-300', 'text-[#fb923c]'];

const TIER_COLORS: Record<string, string> = {
  'Arena Legend': '#ffd54f',
  Diamond:        '#00e5ff',
  Platinum:       '#9c6bff',
  Gold:           '#fb923c',
  Silver:         '#94a3b8',
  Bronze:         '#a16207',
};

type Tab = 'wins' | 'elo' | 'xp';

export default function LeaderboardPage({ navigate }: Props) {
  const { leaders, loading } = useLeaderboard();
  const { publicKey }        = useWallet();
  const wallet               = publicKey?.toBase58() ?? null;

  const [tab, setTab] = useState<Tab>('wins');
  const [rankings, setRankings]     = useState<any[]>([]);
  const [xpTop, setXpTop]           = useState<any[]>([]);
  const [ranksLoading, setRLod]     = useState(false);
  const [xpLoading, setXLod]        = useState(false);

  useEffect(() => {
    if (tab === 'elo' && !rankings.length) {
      setRLod(true);
      fetch(`${API}/api/rankings`)
        .then(r => r.json())
        .then(d => setRankings(d.rankings ?? []))
        .catch(() => {})
        .finally(() => setRLod(false));
    }
    if (tab === 'xp' && !xpTop.length) {
      setXLod(true);
      fetch(`${API}/api/xp/top`)
        .then(r => r.json())
        .then(setXpTop)
        .catch(() => {})
        .finally(() => setXLod(false));
    }
  }, [tab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'wins', label: 'WINS' },
    { id: 'elo',  label: 'ELO RANK' },
    { id: 'xp',   label: 'XP LEVELS' },
  ];

  return (
    <div className="min-h-full bg-[#050810] px-4 py-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate({ name: 'landing' })}
          className="text-gray-500 hover:text-white font-mono text-sm transition-colors">
          ← BACK
        </button>
        <h2 className="text-xl font-extrabold tracking-widest text-[#ffd54f]"
          style={{ fontFamily: 'Syne, sans-serif' }}>
          LEADERBOARD
        </h2>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left: leaderboard tables */}
        <div className="flex-1 min-w-0">
          {/* Tab bar */}
          <div className="flex gap-1 mb-4 border-b border-[#1a2840]">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`font-mono text-xs px-4 py-2 transition-colors border-b-2 -mb-px ${
                  tab === t.id
                    ? 'text-[#00e5ff] border-[#00e5ff]'
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* WINS tab */}
          {tab === 'wins' && (
            loading ? (
              <div className="text-center text-gray-500 font-mono py-20">Loading…</div>
            ) : leaders.length === 0 ? (
              <div className="text-center text-gray-500 font-mono py-20">No data yet. Play a game first!</div>
            ) : (
              <div className="bg-[#0b1120] border border-[#1a2840] rounded-lg overflow-hidden">
                <div className="grid grid-cols-[3rem_1fr_6rem_9rem_7rem] gap-0 border-b border-[#1a2840] px-4 py-3">
                  {['RANK', 'PLAYER', 'WINS', 'EARNED', 'GAMES'].map(h => (
                    <div key={h} className="text-xs font-mono text-gray-500 uppercase tracking-widest">{h}</div>
                  ))}
                </div>
                {leaders.map((entry, idx) => (
                  <div key={entry.wallet}
                    className={`grid grid-cols-[3rem_1fr_6rem_9rem_7rem] gap-0 px-4 py-3 border-b border-[#1a2840]/50 last:border-0
                      ${idx === 0 ? 'bg-[#ffd54f]/5' : idx === 1 ? 'bg-gray-500/5' : idx === 2 ? 'bg-[#fb923c]/5' : ''}
                      hover:bg-white/[0.02] transition-colors`}>
                    <div className={`font-mono font-bold text-sm ${idx < 3 ? RANK_COLORS[idx] : 'text-gray-600'}`}>
                      {idx < 3 ? MEDALS[idx] : `#${idx + 1}`}
                    </div>
                    <div>
                      <div className="font-mono text-sm text-white">{entry.name || '—'}</div>
                      <div className="font-mono text-xs text-gray-600">{truncateAddress(entry.wallet)}</div>
                    </div>
                    <div className="font-mono text-sm text-[#00ff88]">{entry.wins}</div>
                    <div className="font-mono text-sm text-[#ffd54f]">{formatSOL(entry.totalEarned)}</div>
                    <div className="font-mono text-sm text-gray-400">{entry.gamesPlayed}</div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ELO tab */}
          {tab === 'elo' && (
            ranksLoading ? (
              <div className="text-center text-gray-500 font-mono py-20">Loading…</div>
            ) : rankings.length === 0 ? (
              <div className="text-center text-gray-500 font-mono py-20">No ranked data yet.</div>
            ) : (
              <div className="bg-[#0b1120] border border-[#1a2840] rounded-lg overflow-hidden">
                <div className="grid grid-cols-[3rem_1fr_6rem_6rem_6rem] gap-0 border-b border-[#1a2840] px-4 py-3">
                  {['RANK', 'PLAYER', 'TIER', 'ELO', 'W/L'].map(h => (
                    <div key={h} className="text-xs font-mono text-gray-500 uppercase tracking-widest">{h}</div>
                  ))}
                </div>
                {rankings.map((entry, idx) => (
                  <div key={entry.wallet}
                    className="grid grid-cols-[3rem_1fr_6rem_6rem_6rem] gap-0 px-4 py-3 border-b border-[#1a2840]/50 last:border-0 hover:bg-white/[0.02] transition-colors">
                    <div className={`font-mono font-bold text-sm ${idx < 3 ? RANK_COLORS[idx] : 'text-gray-600'}`}>
                      {idx < 3 ? MEDALS[idx] : `#${idx + 1}`}
                    </div>
                    <div>
                      <div className="font-mono text-sm text-white">{entry.name || '—'}</div>
                      <div className="font-mono text-xs text-gray-600">{truncateAddress(entry.wallet)}</div>
                    </div>
                    <div className="font-mono text-xs font-bold" style={{ color: TIER_COLORS[entry.tier] ?? '#fff' }}>
                      {entry.tier}
                    </div>
                    <div className="font-mono text-sm text-[#00e5ff]">{entry.elo}</div>
                    <div className="font-mono text-xs text-gray-400">{entry.wins}W / {entry.losses}L</div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* XP tab */}
          {tab === 'xp' && (
            xpLoading ? (
              <div className="text-center text-gray-500 font-mono py-20">Loading…</div>
            ) : xpTop.length === 0 ? (
              <div className="text-center text-gray-500 font-mono py-20">No XP data yet.</div>
            ) : (
              <div className="bg-[#0b1120] border border-[#1a2840] rounded-lg overflow-hidden">
                <div className="grid grid-cols-[3rem_1fr_6rem_6rem_6rem] gap-0 border-b border-[#1a2840] px-4 py-3">
                  {['RANK', 'PLAYER', 'TITLE', 'LEVEL', 'XP'].map(h => (
                    <div key={h} className="text-xs font-mono text-gray-500 uppercase tracking-widest">{h}</div>
                  ))}
                </div>
                {xpTop.map((entry, idx) => (
                  <div key={entry.wallet}
                    className="grid grid-cols-[3rem_1fr_6rem_6rem_6rem] gap-0 px-4 py-3 border-b border-[#1a2840]/50 last:border-0 hover:bg-white/[0.02] transition-colors">
                    <div className={`font-mono font-bold text-sm ${idx < 3 ? RANK_COLORS[idx] : 'text-gray-600'}`}>
                      {idx < 3 ? MEDALS[idx] : `#${idx + 1}`}
                    </div>
                    <div>
                      <div className="font-mono text-sm text-white">{entry.name || '—'}</div>
                      <div className="font-mono text-xs text-gray-600">{truncateAddress(entry.wallet)}</div>
                    </div>
                    <div className="font-mono text-xs text-[#9c6bff]">{entry.title}</div>
                    <div className="font-mono text-sm text-[#ffd54f]">{entry.level}</div>
                    <div className="font-mono text-xs text-gray-400">{entry.xp.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )
          )}

          <div className="mt-6 text-center">
            <Button variant="primary" onClick={() => navigate({ name: 'lobby' })}>PLAY NOW</Button>
          </div>
        </div>

        {/* Right: personal stats */}
        <div className="w-56 flex flex-col gap-4 shrink-0">
          <XPBadge wallet={wallet} />
          <ChallengePanel wallet={wallet} />
        </div>
      </div>
    </div>
  );
}
