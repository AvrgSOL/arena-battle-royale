import {
  Connection,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

// ── ARENA token constants ────────────────────────────────────────────────────

export const ARENA_DECIMALS = 6;

/** Returns true when the ARENA mint env var is configured. */
export function isArenaConfigured(): boolean {
  return !!(import.meta.env.VITE_ARENA_MINT && import.meta.env.VITE_TREASURY_ADDRESS);
}

export function getArenaMint(): PublicKey {
  return new PublicKey(import.meta.env.VITE_ARENA_MINT as string);
}

export function getTreasuryAddress(): PublicKey {
  return new PublicKey(import.meta.env.VITE_TREASURY_ADDRESS as string);
}

/** Display helper: convert base units → human-readable ARENA amount string */
export function formatArena(baseUnits: number): string {
  if (baseUnits === 0) return 'FREE';
  return (baseUnits / 10 ** ARENA_DECIMALS).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ARENA';
}

/** Get ARENA balance for a wallet (returns human-readable number, not base units). */
export async function getArenaBalance(
  connection: Connection,
  wallet: PublicKey,
): Promise<number> {
  if (!isArenaConfigured()) return 0;
  return (await getTokenBalance(connection, wallet, getArenaMint())) / 10 ** ARENA_DECIMALS;
}

/**
 * Build an unsigned transaction that sends `baseUnits` ARENA from `from`
 * to the treasury. Caller signs via wallet adapter.
 */
export async function buildEntryPaymentTx(
  connection: Connection,
  from: PublicKey,
  baseUnits: number,
): Promise<Transaction> {
  return transferToken(connection, from, getTreasuryAddress(), getArenaMint(), baseUnits);
}

/**
 * Returns the SPL token balance (as a plain number, not lamports) for the
 * given wallet + mint pair.  Returns 0 if the ATA does not exist yet.
 */
export async function getTokenBalance(
  connection: Connection,
  walletPubkey: PublicKey,
  mint: PublicKey,
): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(mint, walletPubkey);
    const acct = await getAccount(connection, ata);
    return Number(acct.amount);
  } catch {
    return 0;
  }
}

/**
 * Builds (but does NOT sign) a transaction that transfers `amount` tokens
 * (in raw token units) from `payer` to `dest`.
 *
 * Creates the destination ATA if it does not already exist.
 */
export async function transferToken(
  connection: Connection,
  payer: PublicKey,
  dest: PublicKey,
  mint: PublicKey,
  amount: number,
): Promise<Transaction> {
  const fromAta = await getAssociatedTokenAddress(mint, payer);
  const toAta   = await getAssociatedTokenAddress(mint, dest);

  const tx = new Transaction();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = payer;

  // Create destination ATA if missing
  const toAcctInfo = await connection.getAccountInfo(toAta);
  if (!toAcctInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        payer,
        toAta,
        dest,
        mint,
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  tx.add(
    createTransferInstruction(
      fromAta,
      toAta,
      payer,
      BigInt(amount),
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  return tx;
}
