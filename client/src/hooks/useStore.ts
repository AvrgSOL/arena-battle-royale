import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

const API = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3002';

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  category: 'skin' | 'trail' | 'emote' | 'badge';
  priceSOL: number;
  priceLamports: number;
  preview: string;
}

export function useStore() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [items, setItems] = useState<StoreItem[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // Fetch catalog on mount
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/store/items`)
      .then(r => r.json())
      .then((data: StoreItem[]) => setItems(data))
      .catch(e => console.error('[useStore] Failed to load items:', e))
      .finally(() => setLoading(false));
  }, []);

  // Fetch owned items when wallet changes
  useEffect(() => {
    if (!publicKey) {
      setOwned([]);
      return;
    }
    fetch(`${API}/api/store/owns/${publicKey.toBase58()}`)
      .then(r => r.json())
      .then((data: { owned: string[] }) => setOwned(data.owned ?? []))
      .catch(e => console.error('[useStore] Failed to load owned items:', e));
  }, [publicKey]);

  async function refreshOwned(): Promise<void> {
    if (!publicKey) return;
    const res = await fetch(`${API}/api/store/owns/${publicKey.toBase58()}`);
    const data = await res.json() as { owned: string[] };
    setOwned(data.owned ?? []);
  }

  async function purchase(item: StoreItem): Promise<void> {
    if (!publicKey) throw new Error('Wallet not connected');
    const devWalletAddr = import.meta.env.VITE_DEV_WALLET_ADDRESS as string | undefined;
    if (!devWalletAddr) throw new Error('VITE_DEV_WALLET_ADDRESS is not configured');

    setPurchasing(item.id);
    try {
      const toPubkey = new PublicKey(devWalletAddr);
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey,
          lamports: item.priceLamports,
        }),
      );

      const txSig = await sendTransaction(tx, connection);

      // Confirm the transaction
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature: txSig, ...latestBlockhash },
        'confirmed',
      );

      // Record purchase on server
      const res = await fetch(`${API}/api/store/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txSig,
          wallet: publicKey.toBase58(),
          itemId: item.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Purchase failed');
      }

      const result = await res.json() as { ok: boolean; owned: string[] };
      setOwned(result.owned ?? []);
    } finally {
      setPurchasing(null);
    }
  }

  return {
    items,
    owned,
    loading,
    purchasing,
    purchase,
    ownsItem: (id: string) => owned.includes(id),
    refreshOwned,
  };
}
