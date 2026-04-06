import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3002';

export interface XPData {
  wallet:      string;
  xp:          number;
  level:       number;
  current:     number; // xp within this level
  needed:      number; // xp needed for next level
  gamesPlayed: number;
  wins:        number;
  title:       string;
}

export function useXP(wallet: string | null) {
  const [data, setData] = useState<XPData | null>(null);

  useEffect(() => {
    if (!wallet) { setData(null); return; }
    fetch(`${API}/api/xp/${encodeURIComponent(wallet)}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [wallet]);

  return data;
}
