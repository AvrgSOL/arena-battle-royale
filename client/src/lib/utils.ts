/** Shorten a wallet address: first 4 + "..." + last 4 chars */
export function truncateAddress(addr: string): string {
  if (!addr || addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

/** Convert lamports to a formatted SOL string, e.g. "1.500 SOL" */
export function formatSOL(lamports: number): string {
  const sol = lamports / 1_000_000_000;
  return `${sol.toFixed(3)} SOL`;
}

/** Format milliseconds as MM:SS */
export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Join class name strings, filtering falsy values */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Format ARENA base units (6 decimals) to a display string, e.g. "100 ARENA" */
export function formatArena(baseUnits: number): string {
  if (baseUnits === 0) return 'FREE';
  const amount = baseUnits / 1_000_000;
  return `${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)} ARENA`;
}
