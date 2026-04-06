import fs from 'fs';
import path from 'path';

const DATA_DIR        = process.env.DATA_DIR ?? path.join(__dirname, '..');
const CHALLENGES_FILE = path.join(DATA_DIR, 'challenges.json');

export interface Challenge {
  id:          string;
  description: string;
  type:        'win' | 'score' | 'survive' | 'food' | 'powerup';
  target:      number;
  reward:      number; // ARENA base units
}

export interface DailyProgress {
  date:    string; // YYYY-MM-DD UTC
  progress: Record<string, number>; // challengeId -> current value
  claimed: string[]; // completed + claimed challengeIds
}

// Rotate through challenge sets based on day-of-year (so each day feels different)
const CHALLENGE_SETS: Challenge[][] = [
  [
    { id: 'c1', description: 'Win 1 game',              type: 'win',     target: 1,   reward: 100_000_000 },
    { id: 'c2', description: 'Score 10 food in one game', type: 'food',  target: 10,  reward: 50_000_000  },
    { id: 'c3', description: 'Survive 300 ticks',       type: 'survive', target: 300, reward: 75_000_000  },
  ],
  [
    { id: 'c4', description: 'Win 2 games',             type: 'win',     target: 2,   reward: 200_000_000 },
    { id: 'c5', description: 'Reach score 15',          type: 'score',   target: 15,  reward: 80_000_000  },
    { id: 'c6', description: 'Collect 3 power-ups',     type: 'powerup', target: 3,   reward: 60_000_000  },
  ],
  [
    { id: 'c7', description: 'Win 1 game',              type: 'win',     target: 1,   reward: 100_000_000 },
    { id: 'c8', description: 'Survive 500 ticks',       type: 'survive', target: 500, reward: 120_000_000 },
    { id: 'c9', description: 'Score 20 food total',     type: 'food',    target: 20,  reward: 90_000_000  },
  ],
  [
    { id: 'c10', description: 'Win 3 games',            type: 'win',     target: 3,   reward: 300_000_000 },
    { id: 'c11', description: 'Reach score 25',         type: 'score',   target: 25,  reward: 100_000_000 },
    { id: 'c12', description: 'Collect 5 power-ups',    type: 'powerup', target: 5,   reward: 80_000_000  },
  ],
  [
    { id: 'c13', description: 'Win 1 game',             type: 'win',     target: 1,   reward: 100_000_000 },
    { id: 'c14', description: 'Score 8 food in one game', type: 'food',  target: 8,   reward: 40_000_000  },
    { id: 'c15', description: 'Survive 200 ticks',      type: 'survive', target: 200, reward: 50_000_000  },
  ],
  [
    { id: 'c16', description: 'Win 2 games',            type: 'win',     target: 2,   reward: 200_000_000 },
    { id: 'c17', description: 'Collect 4 power-ups',    type: 'powerup', target: 4,   reward: 70_000_000  },
    { id: 'c18', description: 'Survive 400 ticks',      type: 'survive', target: 400, reward: 100_000_000 },
  ],
  [
    { id: 'c19', description: 'Win 1 game',             type: 'win',     target: 1,   reward: 100_000_000 },
    { id: 'c20', description: 'Reach score 30',         type: 'score',   target: 30,  reward: 150_000_000 },
    { id: 'c21', description: 'Score 12 food in one game', type: 'food', target: 12,  reward: 60_000_000  },
  ],
];

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayOfYear(dateStr: string): number {
  const d   = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

export function getDailyChallenges(date = todayUTC()): Challenge[] {
  const idx = dayOfYear(date) % CHALLENGE_SETS.length;
  return CHALLENGE_SETS[idx];
}

function load(): Record<string, DailyProgress> {
  try {
    if (!fs.existsSync(CHALLENGES_FILE)) return {};
    return JSON.parse(fs.readFileSync(CHALLENGES_FILE, 'utf8'));
  } catch { return {}; }
}

function save(data: Record<string, DailyProgress>): void {
  try { fs.writeFileSync(CHALLENGES_FILE, JSON.stringify(data, null, 2)); } catch {}
}

export function getChallengeProgress(wallet: string): DailyProgress {
  const data  = load();
  const today = todayUTC();
  const entry = data[wallet];
  if (!entry || entry.date !== today) {
    return { date: today, progress: {}, claimed: [] };
  }
  return entry;
}

/**
 * Update progress for a wallet after a game.
 * Returns the list of challenges that are now complete (for triggering rewards).
 */
export function updateChallengeProgress(
  wallet: string,
  updates: {
    win?:     boolean;
    score?:   number;
    survive?: number;
    food?:    number;
    powerup?: number;
  },
): Challenge[] {
  const today      = todayUTC();
  const data       = load();
  const challenges = getDailyChallenges(today);

  let prog = data[wallet];
  if (!prog || prog.date !== today) {
    prog = { date: today, progress: {}, claimed: [] };
  }

  // Accumulate progress
  for (const ch of challenges) {
    const prev = prog.progress[ch.id] ?? 0;
    let add = 0;

    if (ch.type === 'win'     && updates.win)             add = 1;
    if (ch.type === 'score'   && updates.score  != null)  add = updates.score;
    if (ch.type === 'survive' && updates.survive != null) add = updates.survive;
    if (ch.type === 'food'    && updates.food   != null)  add = updates.food;
    if (ch.type === 'powerup' && updates.powerup != null) add = updates.powerup;

    prog.progress[ch.id] = prev + add;
  }

  // Find newly completed (reached target AND not already claimed)
  const newlyComplete = challenges.filter(ch => {
    const val = prog.progress[ch.id] ?? 0;
    return val >= ch.target && !prog.claimed.includes(ch.id);
  });

  data[wallet] = prog;
  save(data);
  return newlyComplete;
}

/** Mark a challenge as claimed (reward paid). */
export function claimChallenge(wallet: string, challengeId: string): void {
  const today = todayUTC();
  const data  = load();
  let prog = data[wallet];
  if (!prog || prog.date !== today) return;
  if (!prog.claimed.includes(challengeId)) prog.claimed.push(challengeId);
  data[wallet] = prog;
  save(data);
}
