import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '..');
const XP_FILE  = path.join(DATA_DIR, 'xp.json');

export interface XPEntry {
  wallet:      string;
  name:        string;
  xp:          number;
  level:       number;
  gamesPlayed: number;
  wins:        number;
}

// Level n requires n*(n+1)*50 total XP
export function getLevel(xp: number): number {
  let level = 0;
  while (xp >= (level + 1) * (level + 2) * 50) level++;
  return level;
}

export function xpToNextLevel(xp: number): { current: number; needed: number; level: number } {
  const level = getLevel(xp);
  const needed = (level + 1) * (level + 2) * 50;
  const prevNeeded = level === 0 ? 0 : level * (level + 1) * 50;
  return { current: xp - prevNeeded, needed: needed - prevNeeded, level };
}

export const LEVEL_TITLES: Record<number, string> = {
  0:  'Rookie',
  1:  'Scrub',
  3:  'Fighter',
  5:  'Veteran',
  8:  'Elite',
  12: 'Legend',
  18: 'Myth',
  25: 'God',
};

export function getLevelTitle(level: number): string {
  const thresholds = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a);
  for (const t of thresholds) {
    if (level >= t) return LEVEL_TITLES[t];
  }
  return 'Rookie';
}

function load(): Record<string, XPEntry> {
  try {
    if (!fs.existsSync(XP_FILE)) return {};
    return JSON.parse(fs.readFileSync(XP_FILE, 'utf8'));
  } catch { return {}; }
}

function save(data: Record<string, XPEntry>): void {
  try { fs.writeFileSync(XP_FILE, JSON.stringify(data, null, 2)); } catch {}
}

export function awardXP(
  wallet: string,
  name: string,
  score: number,
  survivedTicks: number,
  isWin: boolean,
): XPEntry {
  const data = load();
  const entry: XPEntry = data[wallet] ?? { wallet, name, xp: 0, level: 0, gamesPlayed: 0, wins: 0 };

  const baseXP  = isWin ? 100 : 20;
  const scoreXP = score * 5;
  const timeXP  = Math.floor(survivedTicks * 0.05);
  const gained  = baseXP + scoreXP + timeXP;

  entry.name        = name;
  entry.xp         += gained;
  entry.level       = getLevel(entry.xp);
  entry.gamesPlayed++;
  if (isWin) entry.wins++;

  data[wallet] = entry;
  save(data);
  return entry;
}

export function getXP(wallet: string): XPEntry | null {
  const data = load();
  return data[wallet] ?? null;
}

export function getTopXP(n: number): XPEntry[] {
  const data  = load();
  return Object.values(data)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, n);
}
