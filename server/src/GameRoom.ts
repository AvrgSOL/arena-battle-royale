import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { Snake } from './Snake';
import {
  RoomConfig, GameState, S2CMessage, C2SMessage,
  LobbyPlayer, Vec2, Direction, Zone, PowerUp, PowerUpType,
} from './types';
import { isTokenEnabled, payWinner, burnTokens } from './token';
import { getReferrer, hasBeenRewarded, markRewarded, REFERRAL_BONUS } from './referrals';

const GAMES_LOG = path.join(process.cwd(), '..', 'server', 'games.log');
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
// Zone shrinks 1 cell per side every N ticks; speed increases every M ticks
const DM_ZONE_INTERVAL  = 80;   // ~12s between shrinks
const DM_SPEED_INTERVAL = 100;  // ~15s between speed bumps
const DM_SPEED_STEP     = 15;   // ms faster each bump
const DM_SPEED_MIN      = 70;   // fastest possible tick

// Deathmatch blockers — central obstacles only, spawn corridors kept clear
// Spawns: P1 at (3,15) heading RIGHT, P2 at (36,15) heading LEFT
// Keep x<13 and x>27 at y=14-16 completely clear
const DM_OBSTACLES: Vec2[] = [
  // Centre column — blocks dead-centre forcing players to go around
  { x: 20, y: 12 }, { x: 20, y: 13 }, { x: 20, y: 14 },
  { x: 20, y: 16 }, { x: 20, y: 17 }, { x: 20, y: 18 },
  // Upper-mid barriers (left & right of centre)
  { x: 14, y: 8  }, { x: 15, y: 8  },
  { x: 25, y: 8  }, { x: 26, y: 8  },
  // Lower-mid barriers
  { x: 14, y: 22 }, { x: 15, y: 22 },
  { x: 25, y: 22 }, { x: 26, y: 22 },
  // Inner corner pillars — far enough from spawns
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
  { pos: { x: 5,       y: 15      }, dir: 'RIGHT' },
  { pos: { x: 35,      y: 15      }, dir: 'LEFT'  },
  { pos: { x: 20,      y: 5       }, dir: 'DOWN'  },
  { pos: { x: 20,      y: 25      }, dir: 'UP'    },
  { pos: { x: 5,       y: 5       }, dir: 'RIGHT' },
  { pos: { x: 35,      y: 25      }, dir: 'LEFT'  },
  { pos: { x: 5,       y: 25      }, dir: 'RIGHT' },
  { pos: { x: 35,      y: 5       }, dir: 'LEFT'  },
];

// Deathmatch start positions — opposite corners of 40x30
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

export class GameRoom {
  id:         string;
  config:     RoomConfig;
  private players    = new Map<WebSocket, Snake>();
  private spectators = new Set<WebSocket>();
  private food:      Vec2[]     = [];
  private powerUps:  PowerUp[]  = [];
  private obstacles: Vec2[]     = [];
  private tick       = 0;
  private currentTickMs: number = TICK_MS;
  private zone: Zone | undefined;
  // Per-snake speed-boost ticks remaining
  private speedBoosts = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private onDestroy: () => void;
  private creatorWs: WebSocket | null = null;
  private creatorId: string | null    = null;
  status: 'waiting' | 'countdown' | 'playing' | 'finished' = 'waiting';

  private get isDeathmatch(): boolean {
    return this.config.mode === 'deathmatch';
  }

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

    // First player is the creator
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
    if (snake) { snake.die(); this.players.delete(ws); }
    this.spectators.delete(ws);

    // If creator leaves, reassign to next player
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
    if (this.players.size === 0) {
      this.cleanup();
      this.onDestroy();
    }
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
      this.zone = { x1: 0, y1: 0, x2: this.gridW - 1, y2: this.gridH - 1 };
      this.powerUps = this.spawnPowerUps(DM_POWERUP_COUNT);
    }
    const state = this.buildState();
    broadcast(this.allClients(), { type: 'GAME_START', state });
    this.timer = setInterval(() => this.gameTick(), this.currentTickMs);
    logGame(`Game started room:${this.id} players:${this.players.size} mode:${this.config.mode ?? 'standard'}`);
  }

  private gameTick(): void {
    this.tick++;
    const snakes = [...this.players.values()].filter(s => s.alive);

    // ── Deathmatch: shrink zone ──────────────────────────────────────────────
    if (this.isDeathmatch && this.zone && this.tick % DM_ZONE_INTERVAL === 0) {
      const z = this.zone;
      const newZone: Zone = {
        x1: Math.min(z.x1 + 1, 15),
        y1: Math.min(z.y1 + 1, 10),
        x2: Math.max(z.x2 - 1, 24),
        y2: Math.max(z.y2 - 1, 19),
      };
      // Only shrink if zone actually changed
      if (newZone.x1 <= newZone.x2 && newZone.y1 <= newZone.y2) {
        this.zone = newZone;
      }
    }

    // ── Deathmatch: speed ramp ───────────────────────────────────────────────
    if (this.isDeathmatch && this.tick % DM_SPEED_INTERVAL === 0) {
      const newMs = Math.max(this.currentTickMs - DM_SPEED_STEP, DM_SPEED_MIN);
      if (newMs !== this.currentTickMs) {
        this.currentTickMs = newMs;
        clearInterval(this.timer!);
        this.timer = setInterval(() => this.gameTick(), this.currentTickMs);
      }
    }

    // ── Tick down speed boosts ───────────────────────────────────────────────
    for (const [id, remaining] of this.speedBoosts) {
      if (remaining <= 1) this.speedBoosts.delete(id);
      else this.speedBoosts.set(id, remaining - 1);
    }

    snakes.forEach(s => s.applyPendingDirection());

    const nextHeads = new Map<Snake, Vec2>();
    snakes.forEach(s => nextHeads.set(s, s.nextHead()));

    const obstacleSet = new Set(this.obstacles.map(o => `${o.x},${o.y}`));

    // Wall collisions
    snakes.forEach(s => {
      const h = nextHeads.get(s)!;
      if (h.x < 0 || h.x >= this.gridW || h.y < 0 || h.y >= this.gridH) {
        s.die();
        broadcast(this.allClients(), { type: 'PLAYER_DIED', playerId: s.id, cause: 'wall' });
      }
    });

    // Obstacle collisions
    snakes.filter(s => s.alive).forEach(s => {
      const h = nextHeads.get(s)!;
      if (obstacleSet.has(`${h.x},${h.y}`)) {
        s.die();
        broadcast(this.allClients(), { type: 'PLAYER_DIED', playerId: s.id, cause: 'wall' });
      }
    });

    // Zone collisions — outside the safe zone = death
    if (this.zone) {
      const z = this.zone;
      snakes.filter(s => s.alive).forEach(s => {
        const h = nextHeads.get(s)!;
        if (h.x < z.x1 || h.x > z.x2 || h.y < z.y1 || h.y > z.y2) {
          s.die();
          broadcast(this.allClients(), { type: 'PLAYER_DIED', playerId: s.id, cause: 'wall' });
        }
      });
    }

    const alive = snakes.filter(s => s.alive);

    // Power-up collision
    const toRemovePowerUps: number[] = [];
    alive.forEach(s => {
      const h = nextHeads.get(s)!;
      this.powerUps.forEach((pu, i) => {
        if (pu.pos.x === h.x && pu.pos.y === h.y) {
          toRemovePowerUps.push(i);
          if (pu.kind === 'speed') {
            // Speed boost: snake skips every other tick for 10 ticks
            this.speedBoosts.set(s.id, 20);
          } else if (pu.kind === 'trim') {
            // Trim: cut ALL other snakes' tails by 4 segments
            for (const other of this.players.values()) {
              if (other.id !== s.id && other.alive && other.body.length > 4) {
                other.body.splice(other.body.length - 4, 4);
              }
            }
          }
        }
      });
    });
    // Remove collected power-ups and respawn
    for (let i = toRemovePowerUps.length - 1; i >= 0; i--) {
      this.powerUps.splice(toRemovePowerUps[i], 1);
    }
    if (this.isDeathmatch && toRemovePowerUps.length > 0) {
      this.powerUps.push(...this.spawnPowerUps(toRemovePowerUps.length));
    }

    // Food collision
    const toGrow = new Set<Snake>();
    alive.forEach(s => {
      const h = nextHeads.get(s)!;
      const fi = this.food.findIndex(f => f.x === h.x && f.y === h.y);
      if (fi >= 0) {
        this.food.splice(fi, 1);
        this.food.push(...this.spawnFood(1));
        toGrow.add(s);
      }
    });

    // Self collision
    alive.forEach(s => {
      const h = nextHeads.get(s)!;
      if (s.body.slice(1).some(seg => seg.x === h.x && seg.y === h.y)) {
        s.die();
        broadcast(this.allClients(), { type: 'PLAYER_DIED', playerId: s.id, cause: 'self' });
      }
    });

    const alive2 = alive.filter(s => s.alive);

    // Snake vs snake body collision
    alive2.forEach(a => {
      const h = nextHeads.get(a)!;
      alive2.forEach(b => {
        if (a === b) return;
        if (b.body.some(seg => seg.x === h.x && seg.y === h.y)) {
          a.die();
          broadcast(this.allClients(), { type: 'PLAYER_DIED', playerId: a.id, cause: 'snake' });
        }
      });
    });

    // Head vs head
    const alive3 = alive2.filter(s => s.alive);
    for (let i = 0; i < alive3.length; i++) {
      for (let j = i + 1; j < alive3.length; j++) {
        const ha = nextHeads.get(alive3[i])!;
        const hb = nextHeads.get(alive3[j])!;
        if (ha.x === hb.x && ha.y === hb.y) {
          alive3[i].die();
          alive3[j].die();
          broadcast(this.allClients(), { type: 'PLAYER_DIED', playerId: alive3[i].id, cause: 'snake' });
          broadcast(this.allClients(), { type: 'PLAYER_DIED', playerId: alive3[j].id, cause: 'snake' });
        }
      }
    }

    snakes.filter(s => s.alive).forEach(s => s.step(toGrow.has(s)));

    broadcast(this.allClients(), { type: 'GAME_TICK', state: this.buildState() });

    const remaining = [...this.players.values()].filter(s => s.alive);
    if (remaining.length <= 1 || this.tick > 3000) {
      this.endGame(remaining[0] ?? null);
    }
  }

  private endGame(winner: Snake | null): void {
    if (this.status === 'finished') return;
    this.status = 'finished';
    this.cleanup();

    const totalPot  = this.players.size * this.config.entryFee;
    const burned    = Math.floor(totalPot * 0.05);
    const house     = Math.floor(totalPot * 0.03);
    const pot       = totalPot - burned - house;

    broadcast(this.allClients(), {
      type:       'GAME_OVER',
      winnerId:   winner?.id    ?? null,
      winnerName: winner?.name  ?? null,
      pot,
      burned,
    });

    const potDisplay   = (pot    / 1_000_000).toFixed(2);
    const burnDisplay  = (burned / 1_000_000).toFixed(2);
    const houseDisplay = (house  / 1_000_000).toFixed(2);
    logGame(`GAME_OVER winner:${winner?.name ?? 'none'} pot:${potDisplay} ARENA burned:${burnDisplay} ARENA house:${houseDisplay} ARENA players:${this.players.size}`);

    if (isTokenEnabled() && winner && pot > 0) {
      payWinner(winner.wallet, pot).then(sig => {
        console.log(`[arena] Paid ${potDisplay} ARENA to ${winner.name} — tx: ${sig}`);
      }).catch(e => console.error('[arena] payWinner failed:', e));

      burnTokens(burned).then(sig => {
        console.log(`[arena] Burned ${burnDisplay} ARENA — tx: ${sig}`);
      }).catch(e => console.error('[arena] burnTokens failed:', e));

      if (process.env.DEV_WALLET_ADDRESS && house > 0) {
        payWinner(process.env.DEV_WALLET_ADDRESS, house).catch(() => {});
      }
    }

    if (isTokenEnabled()) {
      for (const snake of this.players.values()) {
        const referrer = getReferrer(snake.wallet);
        if (referrer && !hasBeenRewarded(snake.wallet)) {
          markRewarded(snake.wallet);
          payWinner(snake.wallet, REFERRAL_BONUS).catch(() => {});
          payWinner(referrer, REFERRAL_BONUS).catch(() => {});
          console.log(`[referral] Bonus sent: ${snake.name} + referrer ${referrer.slice(0, 8)}…`);
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
    for (const s of this.players.values()) {
      s.body.forEach(seg => occupied.add(`${seg.x},${seg.y}`));
    }
    this.food.forEach(f => occupied.add(`${f.x},${f.y}`));
    this.powerUps.forEach(p => occupied.add(`${p.pos.x},${p.pos.y}`));
    this.obstacles.forEach(o => occupied.add(`${o.x},${o.y}`));

    const z = this.zone;
    const spawned: Vec2[] = [];
    let attempts = 0;
    while (spawned.length < count && attempts < 200) {
      attempts++;
      const x = z
        ? z.x1 + Math.floor(Math.random() * (z.x2 - z.x1 + 1))
        : Math.floor(Math.random() * this.gridW);
      const y = z
        ? z.y1 + Math.floor(Math.random() * (z.y2 - z.y1 + 1))
        : Math.floor(Math.random() * this.gridH);
      const pos = { x, y };
      if (!occupied.has(`${pos.x},${pos.y}`)) {
        spawned.push(pos);
        occupied.add(`${pos.x},${pos.y}`);
      }
    }
    return spawned;
  }

  private spawnPowerUps(count: number): PowerUp[] {
    const kinds: PowerUpType[] = ['speed', 'trim'];
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
        spawned.push({ pos, kind: kinds[spawned.length % kinds.length] });
        occupied.add(`${pos.x},${pos.y}`);
      }
    }
    return spawned;
  }

  private buildState(): GameState {
    return {
      tick:      this.tick,
      snakes:    [...this.players.values()].map(s => ({
        id:     s.id,
        body:   s.body,
        dir:    s.dir,
        alive:  s.alive,
        score:  s.score,
        color:  s.color,
        wallet: s.wallet,
        name:   s.name,
      })),
      food:      this.food,
      powerUps:  this.powerUps,
      obstacles: this.obstacles,
      gridW:     this.gridW,
      gridH:     this.gridH,
      status:    this.status,
      zone:      this.zone,
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
