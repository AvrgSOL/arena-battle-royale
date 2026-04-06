import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { Snake } from './Snake';
import {
  RoomConfig, GameState, S2CMessage, C2SMessage,
  LobbyPlayer, Vec2, Direction, Zone, PowerUp, PowerUpType, GameEventType,
} from './types';
import { isTokenEnabled, payWinner, payWinnerSol, swapArenaForSol, burnTokens } from './token';
import { getReferrer, hasBeenRewarded, markRewarded, REFERRAL_BONUS } from './referrals';
import { awardXP } from './xp';
import { updateChallengeProgress, claimChallenge, getDailyChallenges } from './challenges';
import { updateELO } from './ranking';
import { recordWin, resetStreak } from './streaks';

const DATA_DIR  = process.env.DATA_DIR ?? path.join(__dirname, '..');
const GAMES_LOG = path.join(DATA_DIR, 'games.log');
function logGame(msg: string): void {
  try { fs.appendFileSync(GAMES_LOG, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
}

// Standard map
const GRID_W     = 40;
const GRID_H     = 30;
const TICK_MS    = 150;
const FOOD_COUNT = 5;

// 1v1 Deathmatch map
const DM_GRID_W        = 40;
const DM_GRID_H        = 30;
const DM_TICK_MS       = 150;
const DM_FOOD_COUNT    = 6;
const DM_POWERUP_COUNT = 2;
const DM_ZONE_INTERVAL  = 80;
const DM_SPEED_INTERVAL = 100;
const DM_SPEED_STEP     = 15;
const DM_SPEED_MIN      = 70;

// Standard mode: spawn a power-up every N ticks
const STD_POWERUP_INTERVAL = 60;
const STD_MAX_POWERUPS     = 3;

// Mid-game events
const EVENT_INTERVAL_MIN = 250;
const EVENT_INTERVAL_RNG = 200;
const EVENT_FOOD_FRENZY_FOOD  = 8;
const EVENT_FOOD_FRENZY_TICKS = 30;  // duration before extra food is removed
const EVENT_SPEED_SURGE_TICKS = 20;
const EVENT_BLACKOUT_TICKS    = 25;

// Power-up weighted pool
const PU_POOL: PowerUpType[] = [
  'speed', 'speed', 'speed',
  'shield', 'shield', 'shield',
  'magnet', 'magnet',
  'trim', 'trim',
  'ghost', 'ghost',
  'freeze', 'freeze',
  'bomb',
];

const DM_OBSTACLES: Vec2[] = [
  { x: 20, y: 12 }, { x: 20, y: 13 }, { x: 20, y: 14 },
  { x: 20, y: 16 }, { x: 20, y: 17 }, { x: 20, y: 18 },
  { x: 14, y: 8  }, { x: 15, y: 8  },
  { x: 25, y: 8  }, { x: 26, y: 8  },
  { x: 14, y: 22 }, { x: 15, y: 22 },
  { x: 25, y: 22 }, { x: 26, y: 22 },
  { x: 13, y: 13 }, { x: 13, y: 14 },
  { x: 27, y: 13 }, { x: 27, y: 14 },
  { x: 13, y: 16 }, { x: 13, y: 17 },
  { x: 27, y: 16 }, { x: 27, y: 17 },
];

const COLORS = [
  '#00e5ff', '#9c6bff', '#00ff88', '#f472b6',
  '#ffd54f', '#ff4d6a', '#4ade80', '#fb923c',
];

const START_POSITIONS: Array<{ pos: Vec2; dir: Direction }> = [
  { pos: { x: 5,  y: 15 }, dir: 'RIGHT' },
  { pos: { x: 35, y: 15 }, dir: 'LEFT'  },
  { pos: { x: 20, y: 5  }, dir: 'DOWN'  },
  { pos: { x: 20, y: 25 }, dir: 'UP'    },
  { pos: { x: 5,  y: 5  }, dir: 'RIGHT' },
  { pos: { x: 35, y: 25 }, dir: 'LEFT'  },
  { pos: { x: 5,  y: 25 }, dir: 'RIGHT' },
  { pos: { x: 35, y: 5  }, dir: 'LEFT'  },
];

const DM_START_POSITIONS: Array<{ pos: Vec2; dir: Direction }> = [
  { pos: { x: 3,  y: 15 }, dir: 'RIGHT' },
  { pos: { x: 36, y: 15 }, dir: 'LEFT'  },
];

function send(ws: WebSocket, msg: S2CMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(clients: Iterable<WebSocket>, msg: S2CMessage): void {
  const str = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(str);
  }
}

function dist(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export class GameRoom {
  id:     string;
  config: RoomConfig;

  private players    = new Map<WebSocket, Snake>();
  private spectators = new Set<WebSocket>();
  private wsToId     = new Map<WebSocket, string>(); // ws → playerId for chat

  private food:      Vec2[]    = [];
  private powerUps:  PowerUp[] = [];
  private obstacles: Vec2[]    = [];
  private tick       = 0;
  private currentTickMs: number = TICK_MS;
  private zone: Zone | undefined;

  private speedBoosts = new Map<string, number>(); // snakeId → remaining ticks
  private timer:          NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private onDestroy: () => void;
  private creatorWs: WebSocket | null = null;
  private creatorId: string | null    = null;

  // Mid-game event state
  private activeEvent: { type: GameEventType; remaining: number } | null = null;
  private nextEventTick = EVENT_INTERVAL_MIN + Math.floor(Math.random() * EVENT_INTERVAL_RNG);
  private eventFoodCount = 0; // extra food spawned during food_frenzy

  // Per-snake powerup ticks (duplicated in Snake but tracked here too for convenience)
  // Actually we read from snake directly

  status: 'waiting' | 'countdown' | 'playing' | 'finished' = 'waiting';

  private get isDeathmatch(): boolean { return this.config.mode === 'deathmatch'; }
  private get gridW():  number { return this.isDeathmatch ? DM_GRID_W  : GRID_W;  }
  private get gridH():  number { return this.isDeathmatch ? DM_GRID_H  : GRID_H;  }
  private get tickMs(): number { return this.isDeathmatch ? DM_TICK_MS : TICK_MS; }
  private get foodCount(): number { return this.isDeathmatch ? DM_FOOD_COUNT : FOOD_COUNT; }
  private get startPositions() { return this.isDeathmatch ? DM_START_POSITIONS : START_POSITIONS; }

  constructor(id: string, config: RoomConfig, onDestroy: () => void) {
    this.id        = id;
    this.config    = config;
    this.onDestroy = onDestroy;
    if (this.isDeathmatch) this.obstacles = [...DM_OBSTACLES];
  }

  addPlayer(ws: WebSocket, wallet: string, displayName: string): string {
    if (this.players.size >= this.config.maxPlayers) throw new Error('Room full');
    if (this.status === 'playing') throw new Error('Game in progress');

    const idx   = this.players.size;
    const sp    = this.startPositions[idx % this.startPositions.length];
    const color = COLORS[idx % COLORS.length];
    const id    = uuid();
    const snake = new Snake(id, sp.pos, sp.dir, color, wallet, displayName);
    this.players.set(ws, snake);
    this.wsToId.set(ws, id);

    if (idx === 0) {
      this.creatorWs = ws;
      this.creatorId = id;
    }

    send(ws, { type: 'ROOM_JOINED', roomId: this.id, playerId: id, color, isCreator: idx === 0 });
    this.broadcastLobbyState();
    logGame(`Player joined room:${this.id} name:${displayName}`);
    return id;
  }

  addSpectator(ws: WebSocket): void {
    this.spectators.add(ws);
    if (this.status === 'playing') {
      send(ws, { type: 'GAME_START', state: this.buildState() });
    }
  }

  removeClient(ws: WebSocket): void {
    const snake = this.players.get(ws);
    if (snake) { snake.die(); this.players.delete(ws); this.wsToId.delete(ws); }
    this.spectators.delete(ws);

    if (ws === this.creatorWs) {
      const next = this.players.keys().next().value as WebSocket | undefined;
      if (next) {
        this.creatorWs = next;
        this.creatorId = this.players.get(next)!.id;
      } else {
        this.creatorWs = null;
        this.creatorId = null;
      }
    }

    this.broadcastLobbyState();
    if (this.players.size === 0) { this.cleanup(); this.onDestroy(); }
  }

  handleMessage(ws: WebSocket, msg: C2SMessage): void {
    if (msg.type === 'DIRECTION') {
      const snake = this.players.get(ws);
      if (snake && snake.alive) snake.setDirection(msg.dir as Direction);
    }

    if (msg.type === 'START_GAME') {
      if (ws !== this.creatorWs) return;
      if (this.status !== 'waiting') return;
      if (this.players.size < 1) return;
      this.startCountdown();
    }

    if (msg.type === 'CHAT') {
      const snake = this.players.get(ws);
      const name  = snake?.name ?? 'Spectator';
      const id    = snake?.id   ?? 'spectator';
      const text  = String(msg.message).slice(0, 200).trim();
      if (!text) return;
      broadcast(this.allClients(), {
        type:       'CHAT_MESSAGE',
        playerId:   id,
        playerName: name,
        message:    text,
        timestamp:  Date.now(),
      });
    }
  }

  private startCountdown(): void {
    this.status = 'countdown';
    let count = 5;
    this.broadcastLobbyState(count);
    this.countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        this.broadcastLobbyState(count);
      } else {
        clearInterval(this.countdownTimer!);
        this.startGame();
      }
    }, 1000);
  }

  private startGame(): void {
    this.status = 'playing';
    this.currentTickMs = this.tickMs;
    this.food = this.spawnFood(this.foodCount);
    if (this.isDeathmatch) {
      this.zone     = { x1: 0, y1: 0, x2: this.gridW - 1, y2: this.gridH - 1 };
      this.powerUps = this.spawnPowerUps(DM_POWERUP_COUNT);
    } else {
      // Standard mode starts with 1 power-up
      this.powerUps = this.spawnPowerUps(1);
    }
    const state = this.buildState();
    broadcast(this.allClients(), { type: 'GAME_START', state });
    this.timer = setInterval(() => this.gameTick(), this.currentTickMs);
    logGame(`Game started room:${this.id} players:${this.players.size} mode:${this.config.mode ?? 'standard'}`);
  }

  private gameTick(): void {
    this.tick++;
    const snakes = [...this.players.values()].filter(s => s.alive);

    // ── Deathmatch: shrink zone ───────────────────────────────────────────────
    if (this.isDeathmatch && this.zone && this.tick % DM_ZONE_INTERVAL === 0) {
      const z = this.zone;
      const newZone: Zone = {
        x1: Math.min(z.x1 + 1, 15),
        y1: Math.min(z.y1 + 1, 10),
        x2: Math.max(z.x2 - 1, 24),
        y2: Math.max(z.y2 - 1, 19),
      };
      if (newZone.x1 <= newZone.x2 && newZone.y1 <= newZone.y2) this.zone = newZone;
    }

    // ── Deathmatch: speed ramp ────────────────────────────────────────────────
    if (this.isDeathmatch && this.tick % DM_SPEED_INTERVAL === 0) {
      const newMs = Math.max(this.currentTickMs - DM_SPEED_STEP, DM_SPEED_MIN);
      if (newMs !== this.currentTickMs) {
        this.currentTickMs = newMs;
        clearInterval(this.timer!);
        this.timer = setInterval(() => this.gameTick(), this.currentTickMs);
      }
    }

    // ── Standard: periodic power-up spawn ────────────────────────────────────
    if (!this.isDeathmatch && this.tick % STD_POWERUP_INTERVAL === 0 && this.powerUps.length < STD_MAX_POWERUPS) {
      this.powerUps.push(...this.spawnPowerUps(1));
    }

    // ── Tick down speed boosts ────────────────────────────────────────────────
    for (const [id, remaining] of this.speedBoosts) {
      if (remaining <= 1) this.speedBoosts.delete(id);
      else this.speedBoosts.set(id, remaining - 1);
    }

    // ── Tick down per-snake power-up effects ──────────────────────────────────
    for (const s of snakes) {
      if (s.ghostTicks  > 0) s.ghostTicks--;
      if (s.frozenTicks > 0) s.frozenTicks--;
      if (s.magnetTicks > 0) s.magnetTicks--;
    }

    // ── Mid-game events ───────────────────────────────────────────────────────
    if (this.activeEvent) {
      this.activeEvent.remaining--;
      if (this.activeEvent.remaining <= 0) {
        this.activeEvent = null;
        this.nextEventTick = this.tick + EVENT_INTERVAL_MIN + Math.floor(Math.random() * EVENT_INTERVAL_RNG);
      }
    } else if (this.tick >= this.nextEventTick && snakes.length >= 2) {
      this.triggerRandomEvent(snakes);
    }

    // ── Frozen snakes don't move ──────────────────────────────────────────────
    const movingSnakes = snakes.filter(s => s.frozenTicks === 0);
    movingSnakes.forEach(s => s.applyPendingDirection());

    const nextHeads = new Map<Snake, Vec2>();
    movingSnakes.forEach(s => nextHeads.set(s, s.nextHead()));
    // Frozen snakes: "next head" is the current head (they stay put)
    snakes.filter(s => s.frozenTicks > 0).forEach(s => nextHeads.set(s, { ...s.body[0] }));

    const obstacleSet = new Set(this.obstacles.map(o => `${o.x},${o.y}`));

    // ── Wall collisions ───────────────────────────────────────────────────────
    snakes.forEach(s => {
      if (s.frozenTicks > 0) return; // frozen snakes can't hit walls mid-freeze
      const h = nextHeads.get(s)!;
      if (h.x < 0 || h.x >= this.gridW || h.y < 0 || h.y >= this.gridH) {
        this.killSnake(s, 'wall');
      }
    });

    // ── Obstacle collisions ───────────────────────────────────────────────────
    snakes.filter(s => s.alive).forEach(s => {
      if (s.frozenTicks > 0) return;
      const h = nextHeads.get(s)!;
      if (obstacleSet.has(`${h.x},${h.y}`)) this.killSnake(s, 'wall');
    });

    // ── Zone collisions ───────────────────────────────────────────────────────
    if (this.zone) {
      const z = this.zone;
      snakes.filter(s => s.alive && s.frozenTicks === 0).forEach(s => {
        const h = nextHeads.get(s)!;
        if (h.x < z.x1 || h.x > z.x2 || h.y < z.y1 || h.y > z.y2) {
          this.killSnake(s, 'zone');
        }
      });
    }

    const alive = snakes.filter(s => s.alive);

    // ── Power-up collection ───────────────────────────────────────────────────
    const toRemovePowerUps: number[] = [];
    alive.forEach(s => {
      const h = nextHeads.get(s)!;
      this.powerUps.forEach((pu, i) => {
        if (pu.pos.x !== h.x || pu.pos.y !== h.y) return;
        toRemovePowerUps.push(i);
        s.magnetTicks = Math.max(s.magnetTicks, 0); // reset so we can track in switch

        switch (pu.kind) {
          case 'speed':
            this.speedBoosts.set(s.id, 20);
            break;

          case 'trim':
            for (const other of this.players.values()) {
              if (other.id !== s.id && other.alive && other.body.length > 4) {
                other.body.splice(other.body.length - 4, 4);
              }
            }
            break;

          case 'shield':
            s.shielded = true;
            break;

          case 'ghost':
            s.ghostTicks = 15;
            break;

          case 'freeze':
            for (const other of this.players.values()) {
              if (other.id !== s.id && other.alive) {
                other.frozenTicks = 10;
              }
            }
            break;

          case 'magnet':
            s.magnetTicks = 15;
            break;

          case 'bomb': {
            // Kill all snakes within Manhattan distance 4
            const bombPos = h;
            const bombed: Snake[] = [];
            for (const other of this.players.values()) {
              if (other.id !== s.id && other.alive && dist(bombPos, other.body[0]) <= 4) {
                bombed.push(other);
              }
            }
            bombed.forEach(victim => this.killSnake(victim, 'bomb'));
            s.score += bombed.length * 3; // bonus score per kill
            break;
          }
        }
      });
    });

    for (let i = toRemovePowerUps.length - 1; i >= 0; i--) {
      this.powerUps.splice(toRemovePowerUps[i], 1);
    }
    // Always respawn collected power-ups
    if (toRemovePowerUps.length > 0) {
      this.powerUps.push(...this.spawnPowerUps(toRemovePowerUps.length));
    }

    // ── Magnet: auto-collect nearby food ─────────────────────────────────────
    const toGrow = new Set<Snake>();
    alive.filter(s => s.alive).forEach(s => {
      const h         = nextHeads.get(s)!;
      const magnetRange = s.magnetTicks > 0 ? 3 : 0;

      this.food.forEach((f, fi) => {
        const d = dist(h, f);
        if (d === 0 || (s.magnetTicks > 0 && d <= magnetRange)) {
          // eat this food
          this.food.splice(fi, 1);
          this.food.push(...this.spawnFood(1));
          toGrow.add(s);
        }
      });
    });

    // Regular food collision for non-magnet snakes
    alive.filter(s => s.alive && s.magnetTicks === 0).forEach(s => {
      const h  = nextHeads.get(s)!;
      const fi = this.food.findIndex(f => f.x === h.x && f.y === h.y);
      if (fi >= 0) {
        this.food.splice(fi, 1);
        this.food.push(...this.spawnFood(1));
        toGrow.add(s);
      }
    });

    // ── Self collision ────────────────────────────────────────────────────────
    alive.filter(s => s.alive).forEach(s => {
      const h = nextHeads.get(s)!;
      if (s.body.slice(1).some(seg => seg.x === h.x && seg.y === h.y)) {
        this.killSnake(s, 'self');
      }
    });

    const alive2 = alive.filter(s => s.alive);

    // ── Snake vs snake body collision (ghost snakes pass through) ─────────────
    alive2.forEach(a => {
      if (a.ghostTicks > 0) return; // ghost snake passes through bodies
      const h = nextHeads.get(a)!;
      alive2.forEach(b => {
        if (a === b) return;
        if (b.body.some(seg => seg.x === h.x && seg.y === h.y)) {
          this.killSnake(a, 'snake');
        }
      });
    });

    // ── Head vs head ──────────────────────────────────────────────────────────
    const alive3 = alive2.filter(s => s.alive);
    for (let i = 0; i < alive3.length; i++) {
      for (let j = i + 1; j < alive3.length; j++) {
        const ha = nextHeads.get(alive3[i])!;
        const hb = nextHeads.get(alive3[j])!;
        if (ha.x === hb.x && ha.y === hb.y) {
          this.killSnake(alive3[i], 'snake');
          this.killSnake(alive3[j], 'snake');
        }
      }
    }

    // ── Step snakes ───────────────────────────────────────────────────────────
    // Only moving snakes step; frozen snakes stay put
    movingSnakes.filter(s => s.alive).forEach(s => s.step(toGrow.has(s)));

    broadcast(this.allClients(), { type: 'GAME_TICK', state: this.buildState() });

    const remaining = [...this.players.values()].filter(s => s.alive);
    if (remaining.length <= 1 || this.tick > 3000) {
      this.endGame(remaining[0] ?? null);
    }
  }

  /** Kill a snake, respecting shield. */
  private killSnake(s: Snake, cause: 'wall' | 'snake' | 'self' | 'zone' | 'bomb'): void {
    if (!s.alive) return;
    if (s.shielded) {
      s.shielded = false; // shield absorbed the hit
      return;
    }
    s.die();
    broadcast(this.allClients(), { type: 'PLAYER_DIED', playerId: s.id, victimName: s.name, cause });
  }

  /** Trigger a random mid-game event. */
  private triggerRandomEvent(alive: Snake[]): void {
    const events: GameEventType[] = ['food_frenzy', 'speed_surge', 'blackout'];
    const type = events[Math.floor(Math.random() * events.length)];

    let duration = EVENT_BLACKOUT_TICKS;
    let label    = '';

    switch (type) {
      case 'food_frenzy':
        duration = EVENT_FOOD_FRENZY_TICKS;
        label    = '🍎 FOOD FRENZY!';
        this.eventFoodCount = EVENT_FOOD_FRENZY_FOOD;
        this.food.push(...this.spawnFood(EVENT_FOOD_FRENZY_FOOD));
        break;

      case 'speed_surge':
        duration = EVENT_SPEED_SURGE_TICKS;
        label    = '⚡ SPEED SURGE!';
        for (const s of alive) this.speedBoosts.set(s.id, EVENT_SPEED_SURGE_TICKS);
        break;

      case 'blackout':
        duration = EVENT_BLACKOUT_TICKS;
        label    = '🌑 BLACKOUT!';
        break;
    }

    this.activeEvent = { type, remaining: duration };
    broadcast(this.allClients(), { type: 'GAME_EVENT', eventType: type, duration, label });
  }

  private endGame(winner: Snake | null): void {
    if (this.status === 'finished') return;
    this.status = 'finished';
    this.cleanup();

    const totalPot   = this.players.size * this.config.entryFee;
    const treasury   = Math.floor(totalPot * 0.07);
    const burned     = Math.floor(totalPot * 0.05);
    const prizeArena = totalPot - treasury - burned;

    // Win streak
    const winStreak = winner ? recordWin(winner.wallet) : 0;
    for (const snake of this.players.values()) {
      if (!winner || snake.id !== winner.id) resetStreak(snake.wallet);
    }

    broadcast(this.allClients(), {
      type:       'GAME_OVER',
      winnerId:   winner?.id   ?? null,
      winnerName: winner?.name ?? null,
      pot:        prizeArena,
      potSol:     null,
      burned,
      winStreak,
    });

    // Award XP + update challenges + ELO
    const losers: Array<{ wallet: string; name: string }> = [];
    for (const snake of this.players.values()) {
      const isWin = winner?.id === snake.id;
      awardXP(snake.wallet, snake.name, snake.score, this.tick, isWin);
      updateChallengeProgress(snake.wallet, {
        win:     isWin || undefined,
        score:   snake.score,
        survive: this.tick,
        food:    snake.score,
      });
      if (!isWin) losers.push({ wallet: snake.wallet, name: snake.name });
    }
    if (winner && losers.length > 0) {
      updateELO(winner.wallet, winner.name, losers);
    }

    // Challenge rewards (auto-claim)
    if (isTokenEnabled()) {
      for (const snake of this.players.values()) {
        const today      = new Date().toISOString().slice(0, 10);
        const challenges = getDailyChallenges(today);
        for (const ch of challenges) {
          // updateChallengeProgress already recorded progress; check if newly complete
          const newly = updateChallengeProgress(snake.wallet, {}); // re-check without adding
          for (const done of newly) {
            claimChallenge(snake.wallet, done.id);
            payWinner(snake.wallet, done.reward).catch(() => {});
            console.log(`[challenge] ${snake.name} completed "${done.description}" → ${done.reward / 1_000_000} ARENA`);
          }
        }
      }
    }

    const arenaDisplay = (prizeArena / 1_000_000).toFixed(2);
    const burnDisplay  = (burned     / 1_000_000).toFixed(2);
    const houseDisplay = (treasury   / 1_000_000).toFixed(2);
    logGame(`GAME_OVER winner:${winner?.name ?? 'none'} prize:${arenaDisplay} ARENA burned:${burnDisplay} ARENA house:${houseDisplay} ARENA players:${this.players.size} streak:${winStreak}`);

    if (isTokenEnabled() && winner && prizeArena > 0) {
      swapArenaForSol(prizeArena).then(async lamports => {
        if (lamports > 0) {
          const sig = await payWinnerSol(winner.wallet, lamports);
          const solDisplay = (lamports / 1e9).toFixed(4);
          console.log(`[arena] Paid ${solDisplay} SOL to ${winner.name} — tx: ${sig}`);
          logGame(`PAID_SOL winner:${winner.name} sol:${solDisplay} tx:${sig}`);
          broadcast(this.allClients(), {
            type: 'PRIZE_PAID',
            winnerId: winner.id,
            solAmount: lamports,
            txSig: sig,
          });
        } else {
          console.warn('[arena] Swap failed, falling back to ARENA payout');
          const sig = await payWinner(winner.wallet, prizeArena);
          console.log(`[arena] Fallback paid ${arenaDisplay} ARENA to ${winner.name} — tx: ${sig}`);
        }
      }).catch(e => console.error('[arena] Prize payout failed:', e));

      burnTokens(burned).then(sig =>
        console.log(`[arena] Burned ${burnDisplay} ARENA — tx: ${sig}`),
      ).catch(e => console.error('[arena] burnTokens failed:', e));

      if (process.env.DEV_WALLET_ADDRESS && treasury > 0) {
        payWinner(process.env.DEV_WALLET_ADDRESS, treasury).catch(() => {});
      }
    }

    if (isTokenEnabled()) {
      for (const snake of this.players.values()) {
        const referrer = getReferrer(snake.wallet);
        if (referrer && !hasBeenRewarded(snake.wallet)) {
          markRewarded(snake.wallet);
          payWinner(snake.wallet, REFERRAL_BONUS).catch(() => {});
          payWinner(referrer, REFERRAL_BONUS).catch(() => {});
        }
      }
    }

    setTimeout(() => this.onDestroy(), 30_000);
  }

  private cleanup(): void {
    if (this.timer)          { clearInterval(this.timer);          this.timer = null; }
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
  }

  private spawnFood(count: number): Vec2[] {
    const occupied = new Set<string>();
    for (const s of this.players.values()) s.body.forEach(seg => occupied.add(`${seg.x},${seg.y}`));
    this.food.forEach(f => occupied.add(`${f.x},${f.y}`));
    this.powerUps.forEach(p => occupied.add(`${p.pos.x},${p.pos.y}`));
    this.obstacles.forEach(o => occupied.add(`${o.x},${o.y}`));

    const z       = this.zone;
    const spawned: Vec2[] = [];
    let attempts  = 0;
    while (spawned.length < count && attempts < 200) {
      attempts++;
      const x = z ? z.x1 + Math.floor(Math.random() * (z.x2 - z.x1 + 1)) : Math.floor(Math.random() * this.gridW);
      const y = z ? z.y1 + Math.floor(Math.random() * (z.y2 - z.y1 + 1)) : Math.floor(Math.random() * this.gridH);
      if (!occupied.has(`${x},${y}`)) {
        spawned.push({ x, y });
        occupied.add(`${x},${y}`);
      }
    }
    return spawned;
  }

  private spawnPowerUps(count: number): PowerUp[] {
    const occupied = new Set<string>();
    for (const s of this.players.values()) s.body.forEach(seg => occupied.add(`${seg.x},${seg.y}`));
    this.food.forEach(f => occupied.add(`${f.x},${f.y}`));
    this.powerUps.forEach(p => occupied.add(`${p.pos.x},${p.pos.y}`));
    this.obstacles.forEach(o => occupied.add(`${o.x},${o.y}`));

    const spawned: PowerUp[] = [];
    let attempts = 0;
    while (spawned.length < count && attempts < 200) {
      attempts++;
      const pos = {
        x: Math.floor(Math.random() * this.gridW),
        y: Math.floor(Math.random() * this.gridH),
      };
      if (!occupied.has(`${pos.x},${pos.y}`)) {
        const kind = PU_POOL[Math.floor(Math.random() * PU_POOL.length)];
        spawned.push({ pos, kind });
        occupied.add(`${pos.x},${pos.y}`);
      }
    }
    return spawned;
  }

  private buildState(): GameState {
    return {
      tick:      this.tick,
      snakes:    [...this.players.values()].map(s => ({
        id:          s.id,
        body:        s.body,
        dir:         s.dir,
        alive:       s.alive,
        score:       s.score,
        color:       s.color,
        wallet:      s.wallet,
        name:        s.name,
        shielded:    s.shielded    || undefined,
        ghostTicks:  s.ghostTicks  || undefined,
        frozenTicks: s.frozenTicks || undefined,
        magnetTicks: s.magnetTicks || undefined,
      })),
      food:        this.food,
      powerUps:    this.powerUps,
      obstacles:   this.obstacles,
      gridW:       this.gridW,
      gridH:       this.gridH,
      status:      this.status,
      zone:        this.zone,
      activeEvent: this.activeEvent?.type ?? null,
    };
  }

  private broadcastLobbyState(countdown: number | null = null): void {
    const players: LobbyPlayer[] = [...this.players.values()].map(s => ({
      id: s.id, name: s.name, wallet: s.wallet, color: s.color,
    }));
    broadcast(this.allClients(), { type: 'LOBBY_STATE', players, countdown, creatorId: this.creatorId });
  }

  private allClients(): Iterable<WebSocket> {
    return [...this.players.keys(), ...this.spectators];
  }

  getSummary() {
    return {
      id:         this.id,
      name:       this.config.name,
      entryFee:   this.config.entryFee,
      players:    this.players.size,
      maxPlayers: this.config.maxPlayers,
      status:     this.status,
      isPrivate:  this.config.isPrivate ?? false,
      mode:       this.config.mode ?? 'standard',
    };
  }
}
