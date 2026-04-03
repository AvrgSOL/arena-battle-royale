import fs from 'fs';

const FILE = 'solo_leaderboard.json';

const ENTRY_FEE_BASE    = 10 * 1_000_000;  // 10 ARENA in base units
const POOL_PCT          = 0.70;             // 70% of fees → prize pool
const PRIZE_SPLIT       = [0.50, 0.30, 0.20]; // top 3

export interface SoloEntry {
  wallet:    string;
  name:      string;
  score:     number;
  week:      number;   // ISO week number
  year:      number;
  txSig:     string;
  timestamp: number;
}

interface PersistedData {
  entries: SoloEntry[];
  usedTxSigs: string[];
}

let entries:    SoloEntry[] = [];
let usedTxSigs: Set<string> = new Set();

function getISOWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

export function currentWeek(): { week: number; year: number } {
  return getISOWeek(new Date());
}

// Load from disk
try {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8')) as PersistedData;
  entries    = data.entries    ?? [];
  usedTxSigs = new Set(data.usedTxSigs ?? []);
} catch { /* first run */ }

function save(): void {
  try {
    fs.writeFileSync(FILE, JSON.stringify({ entries, usedTxSigs: [...usedTxSigs] }, null, 2));
  } catch {}
}

/** Submit a score. Returns error string or null on success. */
export function submitSoloScore(
  wallet: string,
  name:   string,
  score:  number,
  txSig:  string,
): string | null {
  if (usedTxSigs.has(txSig)) return 'Transaction already used';
  usedTxSigs.add(txSig);

  const { week, year } = currentWeek();
  entries.push({ wallet, name, score, week, year, txSig, timestamp: Date.now() });
  save();
  return null;
}

/** Get top N entries for the current week, best score per wallet only. */
export function getWeeklyTop(n = 10): SoloEntry[] {
  const { week, year } = currentWeek();
  const thisWeek = entries.filter(e => e.week === week && e.year === year);

  // Best score per wallet
  const best = new Map<string, SoloEntry>();
  for (const e of thisWeek) {
    const prev = best.get(e.wallet);
    if (!prev || e.score > prev.score) best.set(e.wallet, e);
  }

  return [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

/** Total prize pool for the current week (in ARENA base units). */
export function getWeeklyPool(): number {
  const { week, year } = currentWeek();
  const count = entries.filter(e => e.week === week && e.year === year).length;
  return Math.floor(count * ENTRY_FEE_BASE * POOL_PCT);
}

/** Breakdown of prizes for top 3 (in base units). */
export function getPrizeBreakdown(): number[] {
  const pool = getWeeklyPool();
  return PRIZE_SPLIT.map(pct => Math.floor(pool * pct));
}

export { ENTRY_FEE_BASE };
