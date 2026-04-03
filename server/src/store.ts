import fs from 'fs';
import path from 'path';
import { Connection, PublicKey } from '@solana/web3.js';

// ── Catalog ───────────────────────────────────────────────────────────────────

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  category: 'skin' | 'trail' | 'emote' | 'badge';
  priceSOL: number;
  priceLamports: number;
  preview: string;
}

export const STORE_ITEMS: StoreItem[] = [
  {
    id: 'skin_neon_cyan',
    name: 'Neon Cyan',
    description: 'Electric cyan skin with neon glow.',
    category: 'skin',
    priceSOL: 0.1,
    priceLamports: 0.1 * 1e9,
    preview: '#00e5ff',
  },
  {
    id: 'skin_toxic_green',
    name: 'Toxic Green',
    description: 'Radioactive green skin for the bold.',
    category: 'skin',
    priceSOL: 0.1,
    priceLamports: 0.1 * 1e9,
    preview: '#00ff88',
  },
  {
    id: 'skin_royal_purple',
    name: 'Royal Purple',
    description: 'Regal purple for arena royalty.',
    category: 'skin',
    priceSOL: 0.1,
    priceLamports: 0.1 * 1e9,
    preview: '#9c6bff',
  },
  {
    id: 'skin_blood_red',
    name: 'Blood Red',
    description: 'Intimidating crimson war paint.',
    category: 'skin',
    priceSOL: 0.15,
    priceLamports: 0.15 * 1e9,
    preview: '#ff4d6a',
  },
  {
    id: 'skin_gold',
    name: 'Gold Serpent',
    description: 'Gleaming gold for champions only.',
    category: 'skin',
    priceSOL: 0.25,
    priceLamports: 0.25 * 1e9,
    preview: '#ffd54f',
  },
  {
    id: 'skin_phantom',
    name: 'Phantom',
    description: 'Dark body with white outline — hauntingly fast.',
    category: 'skin',
    priceSOL: 0.5,
    priceLamports: 0.5 * 1e9,
    preview: '#ffffff',
  },
  {
    id: 'trail_fire',
    name: 'Fire Trail',
    description: 'Leave a blazing trail of flames.',
    category: 'trail',
    priceSOL: 0.1,
    priceLamports: 0.1 * 1e9,
    preview: '🔥',
  },
  {
    id: 'trail_rainbow',
    name: 'Rainbow Trail',
    description: 'A spectrum of color follows your every move.',
    category: 'trail',
    priceSOL: 0.15,
    priceLamports: 0.15 * 1e9,
    preview: '🌈',
  },
  {
    id: 'trail_electric',
    name: 'Electric',
    description: 'Crackling electricity in your wake.',
    category: 'trail',
    priceSOL: 0.1,
    priceLamports: 0.1 * 1e9,
    preview: '⚡',
  },
  {
    id: 'trail_ghost',
    name: 'Ghost Trail',
    description: 'A faded transparency trails behind you.',
    category: 'trail',
    priceSOL: 0.1,
    priceLamports: 0.1 * 1e9,
    preview: '👻',
  },
  {
    id: 'emote_skull',
    name: 'Skull Emote',
    description: 'Flash a skull on every kill.',
    category: 'emote',
    priceSOL: 0.05,
    priceLamports: 0.05 * 1e9,
    preview: '💀',
  },
  {
    id: 'emote_crown',
    name: 'Crown Emote',
    description: 'Celebrate your wins with a crown.',
    category: 'emote',
    priceSOL: 0.05,
    priceLamports: 0.05 * 1e9,
    preview: '👑',
  },
  {
    id: 'badge_gold',
    name: 'Gold Name Badge',
    description: 'Display your name in glittering gold.',
    category: 'badge',
    priceSOL: 0.05,
    priceLamports: 0.05 * 1e9,
    preview: '⭐',
  },
];

// ── Purchases DB ──────────────────────────────────────────────────────────────

const DB_PATH = path.join(process.cwd(), 'store', 'purchases.json');

function readDB(): Record<string, string[]> {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

function writeDB(db: Record<string, string[]>): void {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('[store] Failed to write purchases DB:', e);
  }
}

export function getOwnedItems(wallet: string): string[] {
  const db = readDB();
  return db[wallet] ?? [];
}

export function grantItem(wallet: string, itemId: string): void {
  const db = readDB();
  if (!db[wallet]) db[wallet] = [];
  if (!db[wallet].includes(itemId)) {
    db[wallet].push(itemId);
    writeDB(db);
  }
}

export function ownsItem(wallet: string, itemId: string): boolean {
  return getOwnedItems(wallet).includes(itemId);
}

// ── Purchase verification ─────────────────────────────────────────────────────

export async function verifyStorePurchase(
  txSig: string,
  buyerWallet: string,
  expectedLamports: number,
): Promise<boolean> {
  const devWallet = process.env.DEV_WALLET_ADDRESS;
  if (!devWallet) {
    // Dev mode — skip verification
    return true;
  }

  try {
    const rpc = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpc, 'confirmed');

    const tx = await connection.getTransaction(txSig, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx || !tx.meta) return false;
    if (tx.meta.err) return false;

    // Resolve account keys — supports both legacy and versioned transactions
    let accountKeys: PublicKey[];
    if ('transaction' in tx && tx.transaction) {
      const msg = (tx.transaction as { message: { getAccountKeys?: () => { staticAccountKeys: PublicKey[] }; accountKeys?: PublicKey[] } }).message;
      if (msg.getAccountKeys) {
        accountKeys = msg.getAccountKeys().staticAccountKeys;
      } else if (msg.accountKeys) {
        accountKeys = msg.accountKeys;
      } else {
        return false;
      }
    } else {
      return false;
    }

    const devPubkey = new PublicKey(devWallet);
    const devIdx = accountKeys.findIndex(k => k.equals(devPubkey));
    if (devIdx === -1) return false;

    const received =
      tx.meta.postBalances[devIdx] - tx.meta.preBalances[devIdx];

    return received >= expectedLamports;
  } catch (e) {
    // Fails open on RPC errors so a bad node doesn't block purchases
    console.error('[store] verifyStorePurchase RPC error (failing open):', e);
    return true;
  }
}
