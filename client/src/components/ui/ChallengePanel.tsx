import { useChallenges } from '../../hooks/useChallenges';
import { formatArena } from '../../lib/utils';

interface Props {
  wallet: string | null;
}

export default function ChallengePanel({ wallet }: Props) {
  const { data, loading } = useChallenges(wallet);

  if (!wallet) return null;
  if (loading || !data) {
    return (
      <div className="bg-[#0b1120] border border-[#1a2840] rounded-xl p-4 w-full">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">Daily Challenges</div>
        <div className="text-xs text-gray-600 font-mono">Loading…</div>
      </div>
    );
  }

  return (
    <div className="bg-[#0b1120] border border-[#1a2840] rounded-xl p-4 w-full">
      <div className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">Daily Challenges</div>
      <div className="flex flex-col gap-3">
        {data.challenges.map(ch => {
          const progress = data.progress.progress?.[ch.id] ?? 0;
          const claimed  = data.progress.claimed?.includes(ch.id);
          const pct      = Math.min(100, Math.round((progress / ch.target) * 100));
          const done     = progress >= ch.target;

          return (
            <div key={ch.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-mono ${claimed ? 'text-gray-500 line-through' : done ? 'text-[#00ff88]' : 'text-white'}`}>
                  {ch.description}
                </span>
                <span className="text-[10px] font-mono text-[#ffd54f] ml-2 shrink-0">
                  +{formatArena(ch.reward)}
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-[#1a2840] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${claimed ? 'bg-gray-600' : done ? 'bg-[#00ff88]' : 'bg-[#00e5ff]'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-gray-500">
                {claimed ? '✓ Claimed' : `${progress} / ${ch.target}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
