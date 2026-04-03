import { useTokenStats } from '../../hooks/useTokenStats';

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(2)}K`;
  if (n < 0.01)           return `$${n.toFixed(8)}`;
  return `$${n.toFixed(4)}`;
}

function Divider() {
  return <span className="text-[#1a2840] select-none">|</span>;
}

export default function TokenStatsBar() {
  const { stats, loading } = useTokenStats();

  if (loading && !stats) {
    return (
      <div className="w-full bg-[#080d1a] border-b border-[#1a2840] px-4 py-1.5">
        <div className="max-w-7xl mx-auto text-center text-xs font-mono text-[#2a3850]">
          Loading token stats…
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const priceChangePositive = stats.priceChange24h >= 0;
  const marketCap = stats.price * stats.totalSupply;

  return (
    <div className="w-full bg-[#080d1a] border-b border-[#1a2840] px-4 py-1.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-mono">

        {/* Price */}
        <span className="flex items-center gap-1.5">
          <span className="text-[#9c6bff]">◎ Price</span>
          <span className="text-white">{fmtUsd(stats.price)}</span>
          <span
            className={`px-1 py-0.5 rounded text-[10px] font-bold ${
              priceChangePositive
                ? 'bg-[#00ff88]/10 text-[#00ff88]'
                : 'bg-[#ff4d6a]/10 text-[#ff4d6a]'
            }`}
          >
            {priceChangePositive ? '+' : ''}{stats.priceChange24h.toFixed(2)}%
          </span>
        </span>

        <Divider />

        {/* Burned */}
        <span className="flex items-center gap-1.5">
          <span className="text-orange-400">🔥 Burned</span>
          <span className="text-white">
            {fmt(stats.burned)} ARENA
          </span>
          <span className="text-gray-500">({stats.burnedPct.toFixed(2)}%)</span>
        </span>

        <Divider />

        {/* Supply */}
        <span className="flex items-center gap-1.5">
          <span className="text-[#00e5ff]">💎 Supply</span>
          <span className="text-white">{fmt(stats.totalSupply)} ARENA</span>
        </span>

        <Divider />

        {/* Market Cap */}
        <span className="flex items-center gap-1.5">
          <span className="text-[#9c6bff]">📊 Market Cap</span>
          <span className="text-white">{fmtUsd(marketCap)}</span>
        </span>

      </div>
    </div>
  );
}
