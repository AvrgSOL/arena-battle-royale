import fs from 'fs';

const FILE = 'leaderboard.json';

export interface LeaderboardEntry {
  wallet:  string;
  name:    string;
  wins:    number;
  losses:  number;
  earned:  number;
  burned:  number;
}

let entries = new Map<string, LeaderboardEntry>();

// Load from disk on startup
try {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  entries = new Map(Object.entries(data));
} catch { /* first run */ }

function save(): void {
  try { fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(entries), null, 2)); } catch {}
}

export function recordWin(wallet: string, name: string, pot: number, burned: number): void {
  const e = entries.get(wallet) ?? { wallet, name, wins: 0, losses: 0, earned: 0, burned: 0 };
  e.wins++;
  e.earned += pot;
  e.burned += burned;
  entries.set(wallet, e);
  save();
}

export function recordLoss(wallet: string, name: string): void {
  const e = entries.get(wallet) ?? { wallet, name, wins: 0, losses: 0, earned: 0, burned: 0 };
  e.losses++;
  entries.set(wallet, e);
  save();
}

export function getTopN(n: number): LeaderboardEntry[] {
  return [...entries.values()]
    .sort((a, b) => b.wins - a.wins || b.earned - a.earned)
    .slice(0, n);
}
