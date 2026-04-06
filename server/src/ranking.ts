import fs from 'fs';
import path from 'path';

const DATA_DIR     = process.env.DATA_DIR ?? path.join(__dirname, '..');
const RANKING_FILE = path.join(DATA_DIR, 'rankings.json');
const STARTING_ELO  = 1000;
const K             = 32;

export interface RankEntry {
  wallet: string;
  name:   string;
  elo:    number;
  wins:   number;
  losses: number;
  tier:   string;
}

export const TIERS = [
  { name: 'Arena Legend', min: 1900, color: '#ffd54f' },
  { name: 'Diamond',      min: 1700, color: '#00e5ff' },
  { name: 'Platinum',     min: 1500, color: '#9c6bff' },
  { name: 'Gold',         min: 1300, color: '#fb923c' },
  { name: 'Silver',       min: 1100, color: '#94a3b8' },
  { name: 'Bronze',       min: 0,    color: '#a16207' },
];

export function getTier(elo: number): string {
  for (const t of TIERS) {
    if (elo >= t.min) return t.name;
  }
  return 'Bronze';
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function load(): Record<string, RankEntry> {
  try {
    if (!fs.existsSync(RANKING_FILE)) return {};
    return JSON.parse(fs.readFileSync(RANKING_FILE, 'utf8'));
  } catch { return {}; }
}

function save(data: Record<string, RankEntry>): void {
  try { fs.writeFileSync(RANKING_FILE, JSON.stringify(data, null, 2)); } catch {}
}

function ensureEntry(data: Record<string, RankEntry>, wallet: string, name: string): RankEntry {
  if (!data[wallet]) {
    data[wallet] = { wallet, name, elo: STARTING_ELO, wins: 0, losses: 0, tier: 'Bronze' };
  } else {
    data[wallet].name = name;
  }
  return data[wallet];
}

/**
 * Update ELO ratings after a game.
 * winner plays against each loser 1v1, ELO is adjusted accordingly.
 */
export function updateELO(
  winnerWallet: string,
  winnerName:   string,
  losers:       Array<{ wallet: string; name: string }>,
): void {
  if (!winnerWallet || losers.length === 0) return;
  const data = load();

  const winner = ensureEntry(data, winnerWallet, winnerName);

  let eloChange = 0;
  for (const loser of losers) {
    const loserEntry = ensureEntry(data, loser.wallet, loser.name);
    const exp        = expectedScore(winner.elo, loserEntry.elo);
    eloChange       += K * (1 - exp);
    const loserExp   = expectedScore(loserEntry.elo, winner.elo);
    loserEntry.elo   = Math.max(100, Math.round(loserEntry.elo + K * (0 - loserExp)));
    loserEntry.losses++;
    loserEntry.tier  = getTier(loserEntry.elo);
  }

  winner.elo = Math.round(winner.elo + eloChange);
  winner.wins++;
  winner.tier = getTier(winner.elo);

  save(data);
}

export function getRankEntry(wallet: string): RankEntry | null {
  return load()[wallet] ?? null;
}

export function getTopRanked(n: number): RankEntry[] {
  return Object.values(load())
    .sort((a, b) => b.elo - a.elo)
    .slice(0, n);
}
