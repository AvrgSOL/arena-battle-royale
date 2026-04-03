/**
 * One-time script to mint the ARENA SPL token.
 * Run with: npx ts-node scripts/createToken.ts
 *
 * Required env vars:
 *   TREASURY_SECRET_KEY  — JSON array of bytes (base58 decoded secret key)
 *   SOLANA_RPC           — optional, defaults to mainnet-beta
 */
import 'dotenv/config';
import {
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
  AuthorityType,
  getAccount,
} from '@solana/spl-token';

async function main() {
  const rpc = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpc, 'confirmed');

  if (!process.env.TREASURY_SECRET_KEY) {
    throw new Error('TREASURY_SECRET_KEY env var is required');
  }

  const raw = JSON.parse(process.env.TREASURY_SECRET_KEY);
  const treasury = Keypair.fromSecretKey(Uint8Array.from(raw));
  console.log('Treasury wallet:', treasury.publicKey.toBase58());

  const balance = await connection.getBalance(treasury.publicKey);
  console.log(`Treasury SOL balance: ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 10_000_000) {
    throw new Error('Treasury needs at least 0.01 SOL to cover transaction fees');
  }

  // Create mint with 6 decimals
  console.log('\nCreating ARENA mint…');
  const mint = await createMint(
    connection,
    treasury,          // payer
    treasury.publicKey, // mint authority
    null,              // freeze authority — none
    6,                 // decimals
  );
  console.log('Mint address:', mint.toBase58());

  // Create treasury ATA
  console.log('\nCreating treasury token account…');
  const treasuryAta = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    mint,
    treasury.publicKey,
  );
  console.log('Treasury ATA:', treasuryAta.address.toBase58());

  // Mint 1,000,000,000 ARENA (1B tokens × 10^6 base units = 1_000_000_000_000_000)
  const SUPPLY = 1_000_000_000n * 1_000_000n; // 1B tokens at 6 decimals
  console.log('\nMinting 1,000,000,000 ARENA tokens to treasury…');
  const mintTxSig = await mintTo(
    connection,
    treasury,
    mint,
    treasuryAta.address,
    treasury,
    SUPPLY,
  );
  console.log('Mint tx:', mintTxSig);

  // Revoke mint authority (deflationary — no more minting ever)
  console.log('\nRevoking mint authority…');
  const revokeTxSig = await setAuthority(
    connection,
    treasury,
    mint,
    treasury,
    AuthorityType.MintTokens,
    null,
  );
  console.log('Revoke mint authority tx:', revokeTxSig);

  // Confirm balance
  const acct = await getAccount(connection, treasuryAta.address);
  const displayBalance = Number(acct.amount) / 1e6;
  console.log('\n--- ARENA Token Created ---');
  console.log('Mint address:    ', mint.toBase58());
  console.log('Treasury wallet: ', treasury.publicKey.toBase58());
  console.log('Treasury balance:', displayBalance.toLocaleString(), 'ARENA');
  console.log('\nAdd to server/.env:');
  console.log(`ARENA_MINT_ADDRESS=${mint.toBase58()}`);
  console.log('\nAdd to client/.env:');
  console.log(`VITE_ARENA_MINT=${mint.toBase58()}`);
  console.log(`VITE_TREASURY_ADDRESS=${treasury.publicKey.toBase58()}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
