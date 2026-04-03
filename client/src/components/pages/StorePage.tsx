import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Page } from '../../types';
import { useStore, StoreItem } from '../../hooks/useStore';
import Button from '../ui/Button';

interface Props {
  navigate: (p: Page) => void;
  addToast: (msg: string, variant?: 'info' | 'success' | 'error') => void;
}

type CategoryFilter = 'all' | 'skin' | 'trail' | 'emote' | 'badge';

const FILTER_LABELS: { key: CategoryFilter; label: string }[] = [
  { key: 'all',   label: 'ALL'    },
  { key: 'skin',  label: 'SKINS'  },
  { key: 'trail', label: 'TRAILS' },
  { key: 'emote', label: 'EMOTES' },
  { key: 'badge', label: 'BADGES' },
];

function isHex(s: string): boolean {
  return s.startsWith('#');
}

function ItemCard({
  item,
  owned,
  purchasing,
  onBuy,
  walletConnected,
}: {
  item: StoreItem;
  owned: boolean;
  purchasing: boolean;
  onBuy: () => void;
  walletConnected: boolean;
}) {
  const glowColor = isHex(item.preview) ? item.preview : '#00e5ff';

  return (
    <div
      className="relative flex flex-col bg-[#0b1120] border border-[#1a2840] rounded-xl p-5 gap-3 transition-all duration-200 group"
      style={{
        // hover glow applied via CSS variable trick — we use inline style for the dynamic color
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = glowColor;
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 18px 2px ${glowColor}33`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      {/* Preview */}
      <div className="flex justify-center items-center h-20">
        {isHex(item.preview) ? (
          <div
            className="w-16 h-16 rounded-full"
            style={{
              background: item.preview,
              boxShadow: `0 0 24px 6px ${item.preview}66`,
            }}
          />
        ) : (
          <span className="text-5xl select-none">{item.preview}</span>
        )}
      </div>

      {/* Name */}
      <div
        className="text-base font-extrabold text-white text-center"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        {item.name}
      </div>

      {/* Description */}
      <div className="text-xs text-gray-500 font-mono text-center leading-relaxed min-h-[2.5rem]">
        {item.description}
      </div>

      {/* Price */}
      <div className="flex items-center justify-center gap-1 text-sm font-mono font-bold text-[#ffd54f]">
        <span className="text-base">◎</span>
        <span>{item.priceSOL}</span>
      </div>

      {/* CTA */}
      <div className="mt-auto">
        {owned ? (
          <div className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] text-xs font-bold font-mono tracking-widest">
            OWNED ✓
          </div>
        ) : (
          <Button
            size="sm"
            variant="primary"
            className="w-full"
            disabled={purchasing || !walletConnected}
            onClick={onBuy}
          >
            {purchasing ? 'BUYING…' : 'BUY'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function StorePage({ navigate, addToast }: Props) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { items, owned, loading, purchasing, purchase, ownsItem } = useStore();
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [balance, setBalance] = useState<number | null>(null);

  // Fetch SOL balance
  useEffect(() => {
    if (!publicKey) { setBalance(null); return; }
    connection.getBalance(publicKey)
      .then(b => setBalance(b / 1e9))
      .catch(() => setBalance(null));
  }, [publicKey, connection]);

  const handleBuy = useCallback(async (item: StoreItem) => {
    try {
      await purchase(item);
      addToast(`You own ${item.name} now!`, 'success');
      // Refresh balance
      if (publicKey) {
        connection.getBalance(publicKey).then(b => setBalance(b / 1e9)).catch(() => {});
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Purchase failed';
      addToast(msg, 'error');
    }
  }, [purchase, addToast, publicKey, connection]);

  const displayed = filter === 'all'
    ? items
    : items.filter(i => i.category === filter);

  return (
    <div className="min-h-full bg-[#050810] flex flex-col px-4 py-8 max-w-5xl mx-auto w-full">
      {/* Header row */}
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate({ name: 'landing' })}
            className="text-gray-500 hover:text-[#00e5ff] font-mono text-sm transition-colors"
          >
            ← BACK
          </button>
          <h1
            className="text-3xl font-extrabold tracking-[0.2em] text-[#00e5ff] glow-cyan"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            STORE
          </h1>
        </div>

        {publicKey ? (
          <div className="flex items-center gap-2 font-mono text-xs text-gray-400">
            <span>BALANCE</span>
            <span className="text-[#ffd54f] font-bold">
              {balance !== null ? `◎ ${balance.toFixed(4)}` : '—'}
            </span>
          </div>
        ) : (
          <div className="text-xs text-gray-500 font-mono">
            Connect wallet to purchase
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {FILTER_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-widest border transition-all ${
              filter === key
                ? 'bg-[#00e5ff]/10 border-[#00e5ff] text-[#00e5ff]'
                : 'bg-transparent border-[#1a2840] text-gray-500 hover:border-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 font-mono text-sm">
          Loading store…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              owned={ownsItem(item.id)}
              purchasing={purchasing === item.id}
              onBuy={() => handleBuy(item)}
              walletConnected={!!publicKey}
            />
          ))}
        </div>
      )}

      {!loading && displayed.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-500 font-mono text-sm">
          No items in this category.
        </div>
      )}
    </div>
  );
}
