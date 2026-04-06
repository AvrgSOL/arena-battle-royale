// In-memory win streak tracking (resets on server restart — intentional)
const streaks = new Map<string, number>();

export function recordWin(wallet: string): number {
  const streak = (streaks.get(wallet) ?? 0) + 1;
  streaks.set(wallet, streak);
  return streak;
}

export function resetStreak(wallet: string): void {
  streaks.delete(wallet);
}

export function getStreak(wallet: string): number {
  return streaks.get(wallet) ?? 0;
}
