import { useState, useEffect } from 'react';

export interface TokenStats {
  price: number;             // USD price
  priceChange24h: number;    // % change
  totalSupply: number;       // current (after burns), display units
  burned: number;            // total burned tokens (display units)
  burnedPct: number;         // % of supply burned
  circulatingSupply: number; // totalSupply - treasury balance, display units
}

const API_URL = 'http://localhost:3002/api/token/stats';
const POLL_INTERVAL_MS = 30_000;

export function useTokenStats(): { stats: TokenStats | null; loading: boolean } {
  const [stats, setStats]     = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats(): Promise<void> {
      try {
        const res  = await fetch(API_URL);
        const data = await res.json() as TokenStats;
        if (!cancelled) setStats(data);
      } catch {
        // silently fail — stats are non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { stats, loading };
}
