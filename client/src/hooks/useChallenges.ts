import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002';

export interface Challenge {
  id:          string;
  description: string;
  type:        'win' | 'score' | 'survive' | 'food' | 'powerup';
  target:      number;
  reward:      number; // ARENA base units
}

export interface ChallengesData {
  challenges: Challenge[];
  progress: {
    date:     string;
    progress: Record<string, number>;
    claimed:  string[];
  };
}

export function useChallenges(wallet: string | null) {
  const [data, setData]       = useState<ChallengesData | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!wallet) { setData(null); return; }
    setLoading(true);
    fetch(`${API}/api/challenges/progress/${encodeURIComponent(wallet)}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [wallet]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}
