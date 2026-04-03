import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { getArenaBalance, buildEntryPaymentTx, isArenaConfigured } from '../lib/token';

export function useArenaToken() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!publicKey || !isArenaConfigured()) return;
    try {
      const bal = await getArenaBalance(connection, publicKey);
      setBalance(bal);
    } catch {}
  }, [connection, publicKey]);

  // Fetch on connect + poll every 10s
  useEffect(() => {
    fetchBalance();
    const id = setInterval(fetchBalance, 10_000);
    return () => clearInterval(id);
  }, [fetchBalance]);

  /**
   * Build and send an entry payment transaction.
   * `baseUnits` is the raw token amount (e.g. 100_000_000 = 100 ARENA at 6 decimals).
   * Returns the confirmed transaction signature.
   */
  const payEntry = useCallback(async (baseUnits: number): Promise<string> => {
    if (!publicKey) throw new Error('Wallet not connected');
    setLoading(true);
    try {
      const tx = await buildEntryPaymentTx(connection, publicKey, baseUnits);
      const sig = await sendTransaction(tx, connection);
      // Wait for confirmation
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      await fetchBalance();
      return sig;
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey, sendTransaction, fetchBalance]);

  return { balance, loading, payEntry, isConfigured: isArenaConfigured() };
}
