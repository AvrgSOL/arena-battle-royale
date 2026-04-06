import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

const LS_KEY = 'arena_ref';
const API_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3002'}/api/referral/record`;

export function useReferral(): { getReferralLink: () => string } {
  const { publicKey } = useWallet();

  // On mount: capture ?ref= from URL into localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && ref.trim().length > 0) {
      localStorage.setItem(LS_KEY, ref.trim());
      // Clean the URL without reloading
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []);

  // When publicKey is available: send referral record to server
  useEffect(() => {
    if (!publicKey) return;

    const referrerWallet = localStorage.getItem(LS_KEY);
    if (!referrerWallet) return;

    const newWallet = publicKey.toBase58();
    if (newWallet === referrerWallet) {
      localStorage.removeItem(LS_KEY);
      return;
    }

    fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ newWallet, referrerWallet }),
    })
      .then(() => localStorage.removeItem(LS_KEY))
      .catch(() => {/* silently fail */});
  }, [publicKey]);

  function getReferralLink(): string {
    if (!publicKey) return window.location.origin;
    return `${window.location.origin}/?ref=${publicKey.toBase58()}`;
  }

  return { getReferralLink };
}
