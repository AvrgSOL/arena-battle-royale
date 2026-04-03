import fs from 'fs';
import path from 'path';

// ── File-backed DB ───────────────────────────────────────────────────────────

const REFERRALS_FILE = path.join(__dirname, '..', 'store', 'referrals.json');

interface ReferralsStore {
  referred: Record<string, string>; // newWallet → referrerWallet
  rewarded: string[];               // wallets that already received bonus
}

function loadStore(): ReferralsStore {
  try {
    return JSON.parse(fs.readFileSync(REFERRALS_FILE, 'utf8')) as ReferralsStore;
  } catch {
    return { referred: {}, rewarded: [] };
  }
}

function saveStore(store: ReferralsStore): void {
  fs.writeFileSync(REFERRALS_FILE, JSON.stringify(store, null, 2));
}

// ── Public API ───────────────────────────────────────────────────────────────

/** 500 ARENA in base units (6 decimals) */
export const REFERRAL_BONUS = 500 * 1_000_000;

/**
 * Records a referral. Only stores if:
 * - newWallet is not already in the referred map
 * - newWallet !== referrerWallet
 */
export function recordReferral(newWallet: string, referrerWallet: string): void {
  if (!newWallet || !referrerWallet) return;
  if (newWallet === referrerWallet) return;

  const store = loadStore();
  if (store.referred[newWallet]) return; // already referred

  store.referred[newWallet] = referrerWallet;
  saveStore(store);
}

/** Returns the referrer's wallet for the given wallet, or null if none. */
export function getReferrer(wallet: string): string | null {
  const store = loadStore();
  return store.referred[wallet] ?? null;
}

/** Returns true if this wallet has already been issued a referral reward. */
export function hasBeenRewarded(wallet: string): boolean {
  const store = loadStore();
  return store.rewarded.includes(wallet);
}

/** Mark a wallet as having received its referral bonus. */
export function markRewarded(wallet: string): void {
  const store = loadStore();
  if (!store.rewarded.includes(wallet)) {
    store.rewarded.push(wallet);
    saveStore(store);
  }
}
