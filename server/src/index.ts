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
    };
  }

  const rpc  = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';
  const conn = new Connection(rpc, 'confirmed');
  const mint = new PublicKey(mintAddress);

  const mintInfo    = await getMint(conn, mint);
  const currentBase = Number(mintInfo.supply);
  const burned      = Math.max(0, INITIAL_SUPPLY_BASE - currentBase);
  const burnedPct   = (burned / INITIAL_SUPPLY_BASE) * 100;

  const totalSupply       = currentBase / 1_000_000;
  const burnedDisplay     = burned     / 1_000_000;
  const circulatingSupply = totalSupply; // approximation without treasury fetch

  // Jupiter price
  let price         = 0;
  let priceChange24h = 0;
  try {
    const priceRes  = await fetch(
      `https://lite-api.jup.ag/price/v2?ids=${mintAddress}`,
    );
    const priceJson = await priceRes.json() as any;
    const priceData = priceJson?.data?.[mintAddress];
    price          = parseFloat(priceData?.price ?? '0');
    priceChange24h = parseFloat(priceData?.priceChange24h ?? '0');
  } catch {
    // leave price at 0
  }

  return {
    price,
    priceChange24h,
    totalSupply,
    burned:            burnedDisplay,
    burnedPct,
    circulatingSupply,
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
