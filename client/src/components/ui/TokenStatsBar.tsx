import { useTokenStats } from '../../hooks/useTokenStats';

const PUMP_URL = import.meta.env.VITE_PUMP_URL as string | undefined;

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

  const priceUp  = stats.priceChange24h >= 0;
  const mcap     = stats.marketCap > 0 ? stats.marketCap : stats.price * stats.totalSupply;

  return (
    <div className="w-full bg-[#080d1a] border-b border-[#1a2840] px-4 py-1.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-mono">

        {/* Status badge */}
        {!stats.graduated ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/20">
            🌊 Bonding Curve
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20">
            ✅ Raydium
          </span>
        )}

        <Divider />

        {/* Price */}
        <span className="flex items-center gap-1.5">
          <span className="text-[#9c6bff]">◎ Price</span>
          <span className="text-white">{fmtUsd(stats.price)}</span>
          {stats.priceChange24h !== 0 && (
            <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${priceUp ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-[#ff4d6a]/10 text-[#ff4d6a]'}`}>
              {priceUp ? '+' : ''}{stats.priceChange24h.toFixed(2)}%
            </span>
          )}
        </span>

        <Divider />

        {/* Market Cap */}
        <span className="flex items-center gap-1.5">
          <span className="text-[#9c6bff]">📊 MCap</span>
          <span className="text-white">{fmtUsd(mcap)}</span>
        </span>

        <Divider />

        {/* Burned */}
        <span className="flex items-center gap-1.5">
          <span className="text-orange-400">🔥 Burned</span>
          <span className="text-white">{fmt(stats.burned)} ARENA</span>
          {stats.burnedPct > 0 && <span className="text-gray-500">({stats.burnedPct.toFixed(2)}%)</span>}
        </span>

        <Divider />

        {/* Supply */}
        <span className="flex items-center gap-1.5">
          <span className="text-[#00e5ff]">💎 Supply</span>
          <span className="text-white">{fmt(stats.totalSupply)} ARENA</span>
        </span>

        {/* Buy button */}
        {PUMP_URL && (
          <>
            <Divider />
            <a
              href={PUMP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-0.5 rounded text-[10px] font-bold bg-[#00e5ff]/10 border border-[#00e5ff]/30 text-[#00e5ff] hover:bg-[#00e5ff]/20 transition-colors"
            >
              BUY ARENA ↗
            </a>
          </>
        )}

      </div>
    </div>
  );
}
