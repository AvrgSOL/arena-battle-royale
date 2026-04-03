/**
 * Creates an ARENA/SOL CPMM pool on Raydium.
 * Run: npx ts-node scripts/createPool.ts
 *
 * Env vars needed:
 *   TREASURY_SECRET_KEY  — keypair that will provide liquidity + pay fees
 *   ARENA_MINT_ADDRESS   — the ARENA token mint
 *   POOL_SOL_AMOUNT      — SOL to deposit (e.g. "3" for 3 SOL)
 *   POOL_ARENA_AMOUNT    — ARENA tokens to deposit (e.g. "50000000" for 50M ARENA)
 *   SOLANA_RPC           — RPC endpoint
 */

import 'dotenv/config';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  createSyncNativeInstruction,
  NATIVE_MINT,
} from '@solana/spl-token';
import BN from 'bn.js';
import { Raydium, TxVersion } from '@raydium-io/raydium-sdk-v2';

// ── Env validation ───────────────────────────────────────────────────────────

const {
  TREASURY_SECRET_KEY,
  ARENA_MINT_ADDRESS,
  POOL_SOL_AMOUNT,
  POOL_ARENA_AMOUNT,
  SOLANA_RPC = 'https://api.mainnet-beta.solana.com',
} = process.env;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`Error: ${name} env var is required`);
    process.exit(1);
  }
  return value;
}

requireEnv('TREASURY_SECRET_KEY', TREASURY_SECRET_KEY);
requireEnv('ARENA_MINT_ADDRESS',  ARENA_MINT_ADDRESS);
requireEnv('POOL_SOL_AMOUNT',     POOL_SOL_AMOUNT);
requireEnv('POOL_ARENA_AMOUNT',   POOL_ARENA_AMOUNT);

const ARENA_DECIMALS = 6;
const SOL_LAMPORTS   = Math.round(parseFloat(POOL_SOL_AMOUNT!) * 1e9);
const ARENA_BASE     = Math.round(parseFloat(POOL_ARENA_AMOUNT!) * 10 ** ARENA_DECIMALS);

if (SOL_LAMPORTS <= 0 || ARENA_BASE <= 0) {
  console.error('Error: POOL_SOL_AMOUNT and POOL_ARENA_AMOUNT must be positive numbers');
  process.exit(1);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const connection = new Connection(SOLANA_RPC!, 'confirmed');
  const rawKey     = JSON.parse(TREASURY_SECRET_KEY!);
  const treasury   = Keypair.fromSecretKey(Uint8Array.from(rawKey));
  const arenaMint  = new PublicKey(ARENA_MINT_ADDRESS!);

  console.log('\nCreating ARENA/SOL CPMM Pool on Raydium');
  console.log(`  Treasury    : ${treasury.publicKey.toBase58()}`);
  console.log(`  ARENA Mint  : ${arenaMint.toBase58()}`);
  console.log(`  SOL amount  : ${parseFloat(POOL_SOL_AMOUNT!).toFixed(4)} SOL (${SOL_LAMPORTS} lamports)`);
  console.log(`  ARENA amount: ${parseFloat(POOL_ARENA_AMOUNT!).toLocaleString()} ARENA`);
  console.log('');

  // ── Step 1: Wrap SOL to WSOL ─────────────────────────────────────────────

  console.log('Step 1: Wrapping SOL to WSOL...');
  const wsolAta = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    NATIVE_MINT,
    treasury.publicKey,
  );

  const wrapTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey:   wsolAta.address,
      lamports:   SOL_LAMPORTS,
    }),
    createSyncNativeInstruction(wsolAta.address),
  );

  const wrapSig = await sendAndConfirmTransaction(connection, wrapTx, [treasury]);
  console.log(`  WSOL wrap tx: ${wrapSig}`);
  console.log(`  WSOL ATA    : ${wsolAta.address.toBase58()}`);

  // ── Step 2: Initialize Raydium SDK ───────────────────────────────────────

  console.log('\nStep 2: Initializing Raydium SDK...');
  const raydium = await Raydium.load({
    owner:      treasury,
    connection,
    cluster:    'mainnet',
    disableFeatureCheck: true,
  });
  console.log('  Raydium SDK initialized');

  // ── Step 3: Create CPMM pool ─────────────────────────────────────────────

  console.log('\nStep 3: Creating CPMM pool...');

  const { execute, extInfo } = await raydium.cpmm.createPool({
    mint1:       { address: NATIVE_MINT.toBase58(), decimals: 9 } as any,
    mint2:       { address: arenaMint.toBase58(), decimals: ARENA_DECIMALS } as any,
    mintAAmount: new BN(SOL_LAMPORTS),
    mintBAmount: new BN(ARENA_BASE),
    startTime:   new BN(0),
    txVersion:   TxVersion.V0,
  });

  console.log('  Executing pool creation transaction...');
  const { txId } = await execute({ sendAndConfirm: true });

  const poolId = (extInfo as any)?.address?.poolId?.toString() ?? 'unknown';

  // ── Summary ──────────────────────────────────────────────────────────────

  const solAmount   = SOL_LAMPORTS / 1e9;
  const arenaAmount = ARENA_BASE / 10 ** ARENA_DECIMALS;
  const initialPrice = solAmount / arenaAmount; // SOL per ARENA

  console.log('\n── Pool Created Successfully ───────────────');
  console.log(`  Pool Address  : ${poolId}`);
  console.log(`  Tx Signature  : ${txId}`);
  console.log(`  Initial Price : ${initialPrice.toFixed(10)} SOL per ARENA`);
  console.log(`  Initial Price : $${(initialPrice).toExponential(4)} SOL/ARENA`);
  console.log(`  Liquidity     : ${solAmount} SOL + ${arenaAmount.toLocaleString()} ARENA`);
  console.log('');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
