import {
  Connection, Keypair, PublicKey, SystemProgram,
  Transaction, VersionedTransaction, sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
  burn,
  getAssociatedTokenAddress,
} from '@solana/spl-token';

const SOL_MINT      = 'So11111111111111111111111111111111111111112';
const JUPITER_QUOTE = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP  = 'https://quote-api.jup.ag/v6/swap';

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
    const conn        = getConnection();
    const treasury    = getTreasury();
    const mint        = getArenaMint();
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

/**
 * Swap `arenaBaseUnits` ARENA → SOL via Jupiter.
 * Returns the number of lamports received, or 0 on failure.
 */
export async function swapArenaForSol(arenaBaseUnits: number): Promise<number> {
  try {
    const conn     = getConnection();
    const treasury = getTreasury();
    const mint     = getArenaMint().toBase58();

    // 1. Get quote
    const quoteUrl = `${JUPITER_QUOTE}?inputMint=${mint}&outputMint=${SOL_MINT}&amount=${arenaBaseUnits}&slippageBps=150`;
    const quoteRes = await fetch(quoteUrl);
    if (!quoteRes.ok) throw new Error(`Jupiter quote failed: ${quoteRes.status}`);
    const quote = await quoteRes.json() as any;

    const outLamports = Number(quote.outAmount ?? 0);
    if (outLamports === 0) throw new Error('Jupiter quote returned 0 outAmount');

    // 2. Get swap transaction
    const swapRes = await fetch(JUPITER_SWAP, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse:             quote,
        userPublicKey:             treasury.publicKey.toBase58(),
        wrapAndUnwrapSol:          true,
        dynamicComputeUnitLimit:   true,
        prioritizationFeeLamports: 'auto',
      }),
    });
    if (!swapRes.ok) throw new Error(`Jupiter swap build failed: ${swapRes.status}`);
    const { swapTransaction } = await swapRes.json() as any;

    // 3. Deserialize, sign, submit
    const txBuf = Buffer.from(swapTransaction, 'base64');
    const tx    = VersionedTransaction.deserialize(txBuf);
    tx.sign([treasury]);

    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 3 });
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

    console.log(`[token] Swapped ${(arenaBaseUnits / 1_000_000).toFixed(2)} ARENA → ${(outLamports / 1e9).toFixed(4)} SOL  tx:${sig}`);
    return outLamports;
  } catch (e) {
    console.error('[token] swapArenaForSol failed:', e);
    return 0;
  }
}

/**
 * Send `lamports` SOL from treasury to winner wallet.
 */
export async function payWinnerSol(winnerWallet: string, lamports: number): Promise<string> {
  const conn     = getConnection();
  const treasury = getTreasury();

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey:   new PublicKey(winnerWallet),
      lamports,
    }),
  );

  return sendAndConfirmTransaction(conn, tx, [treasury]);
}

/** Send `amount` ARENA base units from treasury to a wallet (used for referral bonuses). */
export async function payWinner(winnerWallet: string, amount: number): Promise<string> {
  const conn     = getConnection();
  const treasury = getTreasury();
  const mint     = getArenaMint();

  const sourceAta = await getOrCreateAssociatedTokenAccount(conn, treasury, mint, treasury.publicKey);
  const destAta   = await getOrCreateAssociatedTokenAccount(conn, treasury, mint, new PublicKey(winnerWallet));

  return transfer(conn, treasury, sourceAta.address, destAta.address, treasury, BigInt(amount));
}

/** Burn `amount` ARENA base units from the treasury ATA. */
export async function burnTokens(amount: number): Promise<string> {
  const conn        = getConnection();
  const treasury    = getTreasury();
  const mint        = getArenaMint();
  const treasuryAta = await getOrCreateAssociatedTokenAccount(conn, treasury, mint, treasury.publicKey);

  return burn(conn, treasury, treasuryAta.address, mint, treasury, BigInt(amount));
}
