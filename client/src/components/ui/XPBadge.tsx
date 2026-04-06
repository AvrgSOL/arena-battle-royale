import { useXP } from '../../hooks/useXP';

interface Props {
  wallet: string | null;
  compact?: boolean;
}

export default function XPBadge({ wallet, compact = false }: Props) {
  const xp = useXP(wallet);
  if (!xp) return null;

  const pct = Math.min(100, Math.round((xp.current / xp.needed) * 100));

  if (compact) {
    return (
      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#1a2840] text-[#ffd54f] border border-[#ffd54f33]">
        Lv.{xp.level}
      </span>
    );
  }

  return (
    <div className="bg-[#0b1120] border border-[#1a2840] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-bold font-mono text-[#ffd54f]">{xp.title}</span>
          <span className="ml-2 text-xs font-mono text-gray-400">Level {xp.level}</span>
        </div>
        <span className="text-xs font-mono text-gray-500">{xp.xp.toLocaleString()} XP</span>
      </div>
      <div className="relative h-2 rounded-full bg-[#1a2840] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#9c6bff] to-[#ffd54f] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] font-mono text-gray-600">{xp.current} / {xp.needed} to next level</span>
        <span className="text-[10px] font-mono text-gray-500">{xp.wins}W · {xp.gamesPlayed - xp.wins}L</span>
      </div>
    </div>
  );
}
