import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';

// ── Arg parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

const listFile    = getArg('--list');
const useLeaderboard = args.includes('--leaderboard');
const amountArg   = getArg('--amount');
const dryRun      = args.includes('--dry-run');

if (!listFile && !useLeaderboard) {
  console.error('Usage:');
  console.error('  npx ts-node scripts/airdrop.ts --list wallets.txt --amount 1000');
  console.error('  npx ts-node scripts/airdrop.ts --leaderboard --amount 500');
  console.error('  Add --dry-run to preview without sending');
  process.exit(1);
}

if (!amountArg || isNaN(Number(amountArg))) {
  console.error('Error: --amount <n> is required (e.g. --amount 1000)');
  process.exit(1);
}

const AMOUNT_HUMAN = Number(amountArg);
const DECIMALS     = 6;
const AMOUNT_BASE  = BigInt(Math.round(AMOUNT_HUMAN * 10 ** DECIMALS));

// ── Env validation ───────────────────────────────────────────────────────────

const TREASURY_SECRET_KEY = process.env.TREASURY_SECRET_KEY;
const ARENA_MINT_ADDRESS  = process.env.ARENA_MINT_ADDRESS;
const SOLANA_RPC          = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';

if (!TREASURY_SECRET_KEY || !ARENA_MINT_ADDRESS) {
  console.error('Error: TREASURY_SECRET_KEY and ARENA_MINT_ADDRESS must be set in .env');
  process.exit(1);
}

// ── Load wallets ─────────────────────────────────────────────────────────────

function loadWalletsFromFile(filePath: string): string[] {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error(`Error: File not found: ${abs}`);
    process.exit(1);
  }
  return fs.readFileSync(abs, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));
}

interface LeaderboardEntry {
  wallet: string;
  name: string;
  wins: number;
  totalEarned: number;
  gamesPlayed: number;
}

function loadWalletsFromLeaderboard(): string[] {
  const lbPath = path.join(__dirname, '..', 'leaderboard.json');
  if (!fs.existsSync(lbPath)) {
    console.error(`Error: leaderboard.json not found at ${lbPath}`);
    process.exit(1);
  }
  const entries: LeaderboardEntry[] = JSON.parse(fs.readFileSync(lbPath, 'utf8'));
  return entries.slice(0, 50).map(e => e.wallet).filter(Boolean);
}

const wallets = listFile
  ? loadWalletsFromFile(listFile)
  : loadWalletsFromLeaderboard();

if (wallets.length === 0) {
  console.error('Error: No wallets found to airdrop to.');
  process.exit(1);
}

// ── Rate-limited airdrop ─────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const conn     = new Connection(SOLANA_RPC, 'confirmed');
  const rawKey   = JSON.parse(TREASURY_SECRET_KEY!);
  const treasury = Keypair.fromSecretKey(Uint8Array.from(rawKey));
  const mint     = new PublicKey(ARENA_MINT_ADDRESS!);

  console.log(`\nARENA Airdrop`);
  console.log(`  Treasury : ${treasury.publicKey.toBase58()}`);
  console.log(`  Mint     : ${mint.toBase58()}`);
  console.log(`  Wallets  : ${wallets.length}`);
  console.log(`  Amount   : ${AMOUNT_HUMAN} ARENA per wallet`);
  console.log(`  Mode     : ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Pre-fetch treasury source ATA once
  let sourceAta: PublicKey | null = null;
  if (!dryRun) {
    const sourceAccount = await getOrCreateAssociatedTokenAccount(
      conn, treasury, mint, treasury.publicKey,
    );
    sourceAta = sourceAccount.address;
  }

  let sent   = 0;
  let failed = 0;
  let totalBase = BigInt(0);

  for (const wallet of wallets) {
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(wallet);
    } catch {
      console.log(`❌ Failed: ${wallet}  reason: invalid public key`);
      failed++;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] Would send ${AMOUNT_HUMAN} ARENA → ${wallet}`);
      sent++;
      totalBase += AMOUNT_BASE;
      continue;
    }

    try {
      const destAccount = await getOrCreateAssociatedTokenAccount(
        conn, treasury, mint, pubkey,
      );

      await transfer(
        conn,
        treasury,
        sourceAta!,
        destAccount.address,
        treasury,
        AMOUNT_BASE,
      );

      console.log(`✅ Sent ${AMOUNT_HUMAN} ARENA → ${wallet}`);
      sent++;
      totalBase += AMOUNT_BASE;
    } catch (e: any) {
      console.log(`❌ Failed: ${wallet}  reason: ${e?.message ?? String(e)}`);
      failed++;
    }

    // Rate limit: 1 airdrop per 500ms
    await sleep(500);
  }

  const totalHuman = Number(totalBase) / 10 ** DECIMALS;
  console.log(`\n── Summary ─────────────────────────────────`);
  console.log(`  Sent   : ${sent} wallets`);
  console.log(`  Failed : ${failed} wallets`);
  console.log(`  Total  : ${totalHuman.toLocaleString()} ARENA distributed`);
  console.log('');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
