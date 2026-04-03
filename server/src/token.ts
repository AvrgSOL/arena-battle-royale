import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
  burn,
  getAssociatedTokenAddress,
} from '@solana/spl-token';

export function isTokenEnabled(): boolean {
  return !!(process.env.ARENA_MINT_ADDRESS && process.env.TREASURY_SECRET_KEY);
}

function getConnection(): Connection {
  return new Connection(
    process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com',
    'confirmed',
  );
}

function getTreasury(): Keypair {
  const raw = JSON.parse(process.env.TREASURY_SECRET_KEY!);
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function getArenaMint(): PublicKey {
  return new PublicKey(process.env.ARENA_MINT_ADDRESS!);
}

/**
 * Verify that txSig represents a confirmed ARENA token transfer of at least
 * `amount` base units into the treasury ATA.
 * Fails open on RPC errors so a bad node doesn't block gameplay.
 */
export async function verifyEntryPayment(
  txSig: string,
  _fromWallet: string,
  amount: number,
): Promise<boolean> {
  try {
    const conn     = getConnection();
    const treasury = getTreasury();
    const mint     = getArenaMint();
    const treasuryAta = await getAssociatedTokenAddress(mint, treasury.publicKey);

    const tx = await conn.getTransaction(txSig, { maxSupportedTransactionVersion: 0 });
    if (!tx || tx.meta?.err) return false;

    const keys = (tx.transaction.message as any).staticAccountKeys
      ?? (tx.transaction.message as any).accountKeys;

    const ataStr = treasuryAta.toBase58();
    const ataIdx = keys.findIndex((k: PublicKey) => k.toBase58() === ataStr);
    if (ataIdx === -1) return false;

    const pre  = tx.meta!.preTokenBalances?.find(b => b.accountIndex === ataIdx);
    const post = tx.meta!.postTokenBalances?.find(b => b.accountIndex === ataIdx);
    if (!post) return false;

    const preAmt  = BigInt(pre?.uiTokenAmount.amount  ?? '0');
    const postAmt = BigInt(post.uiTokenAmount.amount);
    return Number(postAmt - preAmt) >= amount;
  } catch (e) {
    console.warn('[token] verifyEntryPayment error (allowing player in):', e);
    return true; // fail open — don't block on RPC issues
  }
}

/** Send `amount` ARENA base units from treasury to winner wallet. */
export async function payWinner(winnerWallet: string, amount: number): Promise<string> {
  const conn     = getConnection();
  const treasury = getTreasury();
  const mint     = getArenaMint();

  const sourceAta = await getOrCreateAssociatedTokenAccount(
    conn, treasury, mint, treasury.publicKey,
  );
  const destAta = await getOrCreateAssociatedTokenAccount(
    conn, treasury, mint, new PublicKey(winnerWallet),
  );

  return transfer(conn, treasury, sourceAta.address, destAta.address, treasury, BigInt(amount));
}

/** Burn `amount` ARENA base units from the treasury ATA. */
export async function burnTokens(amount: number): Promise<string> {
  const conn     = getConnection();
  const treasury = getTreasury();
  const mint     = getArenaMint();

  const treasuryAta = await getOrCreateAssociatedTokenAccount(
    conn, treasury, mint, treasury.publicKey,
  );

  return burn(conn, treasury, treasuryAta.address, mint, treasury, BigInt(amount));
}
