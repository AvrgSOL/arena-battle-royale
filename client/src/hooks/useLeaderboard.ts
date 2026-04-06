import { useState, useEffect } from 'react';

export interface LeaderEntry {
  wallet:       string;
  name:         string;
  wins:         number;
  totalEarned:  number;
  gamesPlayed:  number;
}

export function useLeaderboard() {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3002'}/api/leaderboard`)
      .then(r => r.json())
      .then((data: LeaderEntry[]) => {
        if (!cancelled) {
          setLeaders(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { leaders, loading };
}
