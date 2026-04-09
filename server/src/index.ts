import 'dotenv/config';
import http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer } from 'ws';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { GameManager } from './GameManager';
import { getTopN } from './leaderboard';
import { STORE_ITEMS, getOwnedItems, grantItem, verifyStorePurchase } from './store';
import { recordReferral } from './referrals';
import { submitSoloScore, getWeeklyTop, getWeeklyPool, getPrizeBreakdown, currentWeek, ENTRY_FEE_BASE } from './soloLeaderboard';
import { verifyEntryPayment } from './token';
import { getXP, getTopXP, xpToNextLevel, getLevelTitle } from './xp';
import { getDailyChallenges, getChallengeProgress } from './challenges';
import { getTopRanked, getRankEntry, TIERS } from './ranking';

const PORT = parseInt(process.env.PORT ?? '3002', 10);
const manager = new GameManager();

// ── Token stats cache ─────────────────────────────────────────────────────────

interface TokenStatsPayload {
  price: number;
  priceChange24h: number;
  totalSupply: number;
  burned: number;
  burnedPct: number;
  circulatingSupply: number;
  marketCap: number;
  graduated: boolean; // false = still on pump.fun bonding curve
}

let tokenStatsCache: TokenStatsPayload | null = null;
let tokenStatsCachedAt  = 0;
const TOKEN_STATS_TTL   = 30_000; // 30s

const INITIAL_SUPPLY_BASE = 1_000_000_000 * 1_000_000; // 1B ARENA at 6 decimals

async function fetchTokenStats(): Promise<TokenStatsPayload> {
  const mintAddress = process.env.ARENA_MINT_ADDRESS;

  if (!mintAddress) {
    // Dev mock
    return {
      price:             0.00001,
      priceChange24h:    2.5,
      totalSupply:       987_500_000,
      burned:            12_500_000,
      burnedPct:         1.25,
      circulatingSupply: 900_000_000,
      marketCap:         9_875,
      graduated:         false,
    };
  }

  // ── Try pump.fun API first (works on bonding curve AND after graduation) ───
  try {
    const pumpRes  = await fetch(`https://frontend-api.pump.fun/coins/${mintAddress}`);
    if (pumpRes.ok) {
      const p = await pumpRes.json() as any;
      const totalSupply = 1_000_000_000; // pump.fun tokens are always 1B
      const price       = p.usd_market_cap ? p.usd_market_cap / totalSupply : 0;
      const marketCap   = p.usd_market_cap ?? 0;
      const graduated   = !!p.complete;

      if (!graduated) {
        // Still on bonding curve — pump.fun data is authoritative
        return {
          price,
          priceChange24h:    0,
          totalSupply,
          burned:            0,
          burnedPct:         0,
          circulatingSupply: totalSupply,
          marketCap,
          graduated:         false,
        };
      }

      // Graduated — get accurate Jupiter price but keep pump.fun supply info
      let jupiterPrice       = price;
      let priceChange24h = 0;
      try {
        const priceRes  = await fetch(`https://lite-api.jup.ag/price/v2?ids=${mintAddress}`);
        const priceJson = await priceRes.json() as any;
        const priceData = priceJson?.data?.[mintAddress];
        jupiterPrice    = parseFloat(priceData?.price ?? String(price));
        priceChange24h  = parseFloat(priceData?.priceChange24h ?? '0');
      } catch { /* use pump.fun price */ }

      // Get on-chain supply for burn tracking
      const rpc  = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';
      const conn = new Connection(rpc, 'confirmed');
      const mintInfo    = await getMint(conn, new PublicKey(mintAddress));
      const currentBase = Number(mintInfo.supply);
      const burned      = Math.max(0, INITIAL_SUPPLY_BASE - currentBase);

      return {
        price:             jupiterPrice,
        priceChange24h,
        totalSupply:       currentBase / 1_000_000,
        burned:            burned / 1_000_000,
        burnedPct:         (burned / INITIAL_SUPPLY_BASE) * 100,
        circulatingSupply: currentBase / 1_000_000,
        marketCap:         jupiterPrice * (currentBase / 1_000_000),
        graduated:         true,
      };
    }
  } catch { /* fall through to Jupiter-only path */ }

  // ── Fallback: Jupiter only (if pump.fun API is down) ─────────────────────
  const rpc  = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';
  const conn = new Connection(rpc, 'confirmed');
  const mintInfo    = await getMint(conn, new PublicKey(mintAddress));
  const currentBase = Number(mintInfo.supply);
  const burned      = Math.max(0, INITIAL_SUPPLY_BASE - currentBase);
  const totalSupply = currentBase / 1_000_000;

  let price         = 0;
  let priceChange24h = 0;
  try {
    const priceRes  = await fetch(`https://lite-api.jup.ag/price/v2?ids=${mintAddress}`);
    const priceJson = await priceRes.json() as any;
    const priceData = priceJson?.data?.[mintAddress];
    price          = parseFloat(priceData?.price ?? '0');
    priceChange24h = parseFloat(priceData?.priceChange24h ?? '0');
  } catch { /* leave at 0 */ }

  return {
    price,
    priceChange24h,
    totalSupply,
    burned:            burned / 1_000_000,
    burnedPct:         (burned / INITIAL_SUPPLY_BASE) * 100,
    circulatingSupply: totalSupply,
    marketCap:         price * totalSupply,
    graduated:         true,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function setCORSHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
}

// ── HTTP server (API routes) ──────────────────────────────────────────────────
const httpServer = http.createServer(async (req, res) => {
  setCORSHeaders(res);

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url ?? '';

  if (url === '/api/leaderboard') {
    res.end(JSON.stringify(getTopN(50)));
    return;
  }
  if (url === '/api/rooms') {
    res.end(JSON.stringify(manager.getRoomSummaries()));
    return;
  }
  if (url === '/api/stats') {
    res.end(JSON.stringify({
      activeRooms:   manager.getRoomSummaries().length,
      activePlayers: manager.getRoomSummaries().reduce((s, r) => s + r.players, 0),
    }));
    return;
  }

  // ── Store routes ────────────────────────────────────────────────────────────

  if (url === '/api/store/items' && req.method === 'GET') {
    res.end(JSON.stringify(STORE_ITEMS));
    return;
  }

  const ownsMatch = url.match(/^\/api\/store\/owns\/(.+)$/);
  if (ownsMatch && req.method === 'GET') {
    const wallet = decodeURIComponent(ownsMatch[1]);
    try {
      const owned = getOwnedItems(wallet);
      res.end(JSON.stringify({ owned }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch owned items' }));
    }
    return;
  }

  if (url === '/api/store/purchase' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw) as { txSig?: string; wallet?: string; itemId?: string };

      const { txSig, wallet, itemId } = body;
      if (!txSig || !wallet || !itemId) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing txSig, wallet, or itemId' }));
        return;
      }

      const item = STORE_ITEMS.find(i => i.id === itemId);
      if (!item) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Unknown itemId' }));
        return;
      }

      const valid = await verifyStorePurchase(txSig, wallet, item.priceLamports);
      if (!valid) {
        res.writeHead(402);
        res.end(JSON.stringify({ error: 'Transaction verification failed' }));
        return;
      }

      grantItem(wallet, itemId);
      const owned = getOwnedItems(wallet);
      res.end(JSON.stringify({ ok: true, owned }));
    } catch (e) {
      console.error('[store] /api/store/purchase error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  // ── Token stats ──────────────────────────────────────────────────────────

  if (url === '/api/token/stats' && req.method === 'GET') {
    try {
      const now = Date.now();
      if (!tokenStatsCache || now - tokenStatsCachedAt > TOKEN_STATS_TTL) {
        tokenStatsCache    = await fetchTokenStats();
        tokenStatsCachedAt = now;
      }
      res.end(JSON.stringify(tokenStatsCache));
    } catch (e) {
      console.error('[token/stats] error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to fetch token stats' }));
    }
    return;
  }

  // ── Referral ─────────────────────────────────────────────────────────────

  if (url === '/api/referral/record' && req.method === 'POST') {
    try {
      const raw  = await readBody(req);
      const body = JSON.parse(raw) as { newWallet?: string; referrerWallet?: string };
      const { newWallet, referrerWallet } = body;
      if (!newWallet || !referrerWallet) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing newWallet or referrerWallet' }));
        return;
      }
      recordReferral(newWallet, referrerWallet);
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      console.error('[referral] /api/referral/record error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  // ── Solo leaderboard ────────────────────────────────────────────────────
  if (url === '/api/solo/leaderboard' && req.method === 'GET') {
    res.end(JSON.stringify({
      entries:  getWeeklyTop(10),
      pool:     getWeeklyPool(),
      prizes:   getPrizeBreakdown(),
      entryFee: ENTRY_FEE_BASE,
      week:     currentWeek(),
    }));
    return;
  }

  if (url === '/api/solo/score' && req.method === 'POST') {
    try {
      const raw  = await readBody(req);
      const body = JSON.parse(raw) as { wallet?: string; name?: string; score?: number; txSig?: string };
      const { wallet, name, score, txSig } = body;

      if (!wallet || !name || score == null || !txSig) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing fields' }));
        return;
      }

      // Verify the ARENA payment if token is configured
      const tokenEnabled = !!(process.env.ARENA_MINT_ADDRESS && process.env.TREASURY_ADDRESS);
      if (tokenEnabled) {
        const valid = await verifyEntryPayment(txSig, wallet, ENTRY_FEE_BASE);
        if (!valid) {
          res.writeHead(402);
          res.end(JSON.stringify({ error: 'Payment verification failed' }));
          return;
        }
      }

      const err = submitSoloScore(wallet, name, score, txSig);
      if (err) {
        res.writeHead(409);
        res.end(JSON.stringify({ error: err }));
        return;
      }

      res.end(JSON.stringify({ ok: true, leaderboard: getWeeklyTop(10) }));
    } catch (e) {
      console.error('[solo/score] error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  // ── XP / Levels ─────────────────────────────────────────────────────────
  // NOTE: /api/xp/top must be checked BEFORE the wallet pattern to avoid "top" being treated as a wallet
  if (url === '/api/xp/top' && req.method === 'GET') {
    res.end(JSON.stringify(getTopXP(50).map(e => ({
      ...e,
      title: getLevelTitle(e.level),
    }))));
    return;
  }

  const xpWalletMatch = url.match(/^\/api\/xp\/(.+)$/);
  if (xpWalletMatch && req.method === 'GET') {
    const wallet = decodeURIComponent(xpWalletMatch[1]);
    const entry  = getXP(wallet);
    if (entry) {
      const progress = xpToNextLevel(entry.xp);
      res.end(JSON.stringify({ ...entry, ...progress, title: getLevelTitle(entry.level) }));
    } else {
      res.end(JSON.stringify({ wallet, xp: 0, level: 0, current: 0, needed: 100, gamesPlayed: 0, wins: 0, title: 'Rookie' }));
    }
    return;
  }

  // ── Daily Challenges ─────────────────────────────────────────────────────
  if (url === '/api/challenges' && req.method === 'GET') {
    res.end(JSON.stringify(getDailyChallenges()));
    return;
  }

  const challengeProgressMatch = url.match(/^\/api\/challenges\/progress\/(.+)$/);
  if (challengeProgressMatch && req.method === 'GET') {
    const wallet   = decodeURIComponent(challengeProgressMatch[1]);
    const prog     = getChallengeProgress(wallet);
    const today    = getDailyChallenges();
    res.end(JSON.stringify({ challenges: today, progress: prog }));
    return;
  }

  // ── ELO Rankings ─────────────────────────────────────────────────────────
  if (url === '/api/rankings' && req.method === 'GET') {
    res.end(JSON.stringify({ rankings: getTopRanked(50), tiers: TIERS }));
    return;
  }

  const rankWalletMatch = url.match(/^\/api\/rankings\/(.+)$/);
  if (rankWalletMatch && req.method === 'GET') {
    const wallet = decodeURIComponent(rankWalletMatch[1]);
    const entry  = getRankEntry(wallet);
    res.end(JSON.stringify(entry ?? { wallet, elo: 1000, tier: 'Bronze', wins: 0, losses: 0 }));
    return;
  }

  res.writeHead(404);
  res.end('{}');
});

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  manager.handleConnection(ws);
  ws.on('message', (data) => {
    try { manager.handleMessage(ws, data.toString()); } catch {}
  });
  ws.on('close',   () => manager.handleClose(ws));
  ws.on('error',   () => ws.terminate());
});

httpServer.listen(PORT, () => {
  console.log(`\n⚔️  ARENA server running on port ${PORT}`);
  console.log(`   WS:  ws://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/rooms\n`);
});
