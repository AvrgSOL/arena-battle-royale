import { useState, useEffect, useRef, useCallback } from 'react';
import { Vec2, Direction } from '../types';

export const SOLO_W = 40;
export const SOLO_H = 30;
const TICK_MS        = 150;
const FOOD_COUNT     = 3;
const LEVEL_UP_TICKS = 30;   // level every ~4.5 seconds
const OBSTACLE_PER_LEVEL = 2;
const POWERUP_SPAWN_INTERVAL = 25; // try to spawn every 25 ticks
const POWERUP_MAX_ON_BOARD   = 2;
const POWERUP_LIFESPAN       = 60; // ticks before a power-up despawns

// Hunter move interval per level (ticks between each hunter step)
function hunterInterval(level: number): number {
  return Math.max(2, 9 - level);
}

export interface Hunter { id: number; pos: Vec2; }

export type SoloPowerUpType = 'freeze' | 'shield' | 'bomb' | 'star';
export interface SoloPowerUp { id: number; pos: Vec2; kind: SoloPowerUpType; spawnTick: number; }

export interface SoloEffects {
  freezeTicks: number;  // hunters can't move while > 0
  shieldActive: boolean; // absorbs next fatal hit
  starTicks: number;    // 2× score multiplier while > 0
}

export interface SoloState {
  snake:        Vec2[];
  dir:          Direction;
  food:         Vec2[];
  hunters:      Hunter[];
  obstacles:    Vec2[];
  powerUps:     SoloPowerUp[];
  effects:      SoloEffects;
  level:        number;
  score:        number;
  tick:         number;
  alive:        boolean;
  started:      boolean;
  highScore:    number;
  levelUpFlash: boolean;
  lastPickup:   SoloPowerUpType | null; // for HUD flash
}

// ── helpers ─────────────────────────────────────────────────────────────────

function occupied(state: Pick<SoloState, 'snake' | 'food' | 'hunters' | 'obstacles' | 'powerUps'>): Set<string> {
  const s = new Set<string>();
  state.snake.forEach(p => s.add(`${p.x},${p.y}`));
  state.food.forEach(p => s.add(`${p.x},${p.y}`));
  state.hunters.forEach(h => s.add(`${h.pos.x},${h.pos.y}`));
  state.obstacles.forEach(p => s.add(`${p.x},${p.y}`));
  state.powerUps.forEach(p => s.add(`${p.pos.x},${p.pos.y}`));
  return s;
}

function spawnItems(occ: Set<string>, count: number): Vec2[] {
  const items: Vec2[] = [];
  let attempts = 0;
  while (items.length < count && attempts < 400) {
    attempts++;
    const p = { x: Math.floor(Math.random() * SOLO_W), y: Math.floor(Math.random() * SOLO_H) };
    const k = `${p.x},${p.y}`;
    if (!occ.has(k)) { items.push(p); occ.add(k); }
  }
  return items;
}

function randomEdge(occ: Set<string>): Vec2 | null {
  for (let attempt = 0; attempt < 40; attempt++) {
    const edge = Math.floor(Math.random() * 4);
    let p: Vec2;
    switch (edge) {
      case 0: p = { x: Math.floor(Math.random() * SOLO_W), y: 0 }; break;
      case 1: p = { x: Math.floor(Math.random() * SOLO_W), y: SOLO_H - 1 }; break;
      case 2: p = { x: 0, y: Math.floor(Math.random() * SOLO_H) }; break;
      default: p = { x: SOLO_W - 1, y: Math.floor(Math.random() * SOLO_H) };
    }
    if (!occ.has(`${p.x},${p.y}`)) return p;
  }
  return null;
}

function stepHunter(h: Vec2, head: Vec2, occ: Set<string>): Vec2 {
  const dx = head.x - h.x;
  const dy = head.y - h.y;
  const primary: Vec2[]   = [];
  const secondary: Vec2[] = [];

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx !== 0) primary.push({ x: h.x + Math.sign(dx), y: h.y });
    if (dy !== 0) secondary.push({ x: h.x, y: h.y + Math.sign(dy) });
  } else {
    if (dy !== 0) primary.push({ x: h.x, y: h.y + Math.sign(dy) });
    if (dx !== 0) secondary.push({ x: h.x + Math.sign(dx), y: h.y });
  }

  for (const p of [...primary, ...secondary]) {
    if (p.x >= 0 && p.x < SOLO_W && p.y >= 0 && p.y < SOLO_H && !occ.has(`${p.x},${p.y}`)) {
      return p;
    }
  }
  return h;
}

function oppositeDir(d: Direction): Direction {
  return d === 'UP' ? 'DOWN' : d === 'DOWN' ? 'UP' : d === 'LEFT' ? 'RIGHT' : 'LEFT';
}

const POWERUP_TYPES: SoloPowerUpType[] = ['freeze', 'shield', 'bomb', 'star'];

function pickPowerUpType(): SoloPowerUpType {
  return POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
}

function initialState(hs: number): SoloState {
  const snake: Vec2[] = [{ x: 20, y: 15 }, { x: 19, y: 15 }, { x: 18, y: 15 }];
  const occ = new Set(snake.map(p => `${p.x},${p.y}`));
  return {
    snake,
    dir:          'RIGHT',
    food:         spawnItems(occ, FOOD_COUNT),
    hunters:      [],
    obstacles:    [],
    powerUps:     [],
    effects:      { freezeTicks: 0, shieldActive: false, starTicks: 0 },
    level:        0,
    score:        0,
    tick:         0,
    alive:        false,
    started:      false,
    highScore:    hs,
    levelUpFlash: false,
    lastPickup:   null,
  };
}

// ── hook ─────────────────────────────────────────────────────────────────────

export function useSoloGame() {
  const hsRef     = useRef(parseInt(localStorage.getItem('arena_solo_hs') ?? '0', 10));
  const [state, setState] = useState<SoloState>(() => initialState(hsRef.current));
  const gameRef   = useRef<SoloState>(state);
  const dirRef    = useRef<Direction>('RIGHT');
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextIdRef = useRef(1);
  const nextPuIdRef = useRef(1);

  // Keep ref in sync for the tick closure
  useEffect(() => { gameRef.current = state; }, [state]);

  const tick = useCallback(() => {
    const g = gameRef.current;
    if (!g.alive) return;

    const newTick = g.tick + 1;

    // ── direction ──────────────────────────────────────────────────────────
    let dir = dirRef.current;
    if (dir === oppositeDir(g.dir)) dir = g.dir; // prevent 180

    // ── move snake ─────────────────────────────────────────────────────────
    const head = g.snake[0];
    const newHead: Vec2 = {
      x: head.x + (dir === 'RIGHT' ? 1 : dir === 'LEFT' ? -1 : 0),
      y: head.y + (dir === 'DOWN'  ? 1 : dir === 'UP'   ? -1 : 0),
    };

    // ── tick down active effects ───────────────────────────────────────────
    const newEffects: SoloEffects = {
      freezeTicks:  Math.max(0, g.effects.freezeTicks - 1),
      shieldActive: g.effects.shieldActive,
      starTicks:    Math.max(0, g.effects.starTicks - 1),
    };

    // ── death check helper (respects shield) ──────────────────────────────
    function wouldDie(): boolean {
      // Wall death
      if (newHead.x < 0 || newHead.x >= SOLO_W || newHead.y < 0 || newHead.y >= SOLO_H) return true;
      // Obstacle death
      if (g.obstacles.some(o => o.x === newHead.x && o.y === newHead.y)) return true;
      // Self-collision
      if (g.snake.slice(1).some(s => s.x === newHead.x && s.y === newHead.y)) return true;
      // Hunter collision — snake head moves into a hunter
      if (g.hunters.some(h => h.pos.x === newHead.x && h.pos.y === newHead.y)) return true;
      return false;
    }

    if (wouldDie()) {
      if (newEffects.shieldActive) {
        newEffects.shieldActive = false;
        // bounce: don't move, keep direction
        const bounce: SoloState = { ...g, effects: newEffects, tick: newTick, levelUpFlash: false, lastPickup: null };
        gameRef.current = bounce;
        setState(bounce);
        return;
      }
      return endGame(g);
    }

    // Food?
    const ateFoodIdx = g.food.findIndex(f => f.x === newHead.x && f.y === newHead.y);
    const ateFood = ateFoodIdx >= 0;
    const newSnake = [newHead, ...g.snake.slice(0, ateFood ? undefined : -1)];

    let newFood = g.food;
    let newScore = g.score;
    if (ateFood) {
      const gain = newEffects.starTicks > 0 ? 20 : 10;
      newScore += gain;
      const occ2 = new Set(newSnake.map(p => `${p.x},${p.y}`));
      g.hunters.forEach(h => occ2.add(`${h.pos.x},${h.pos.y}`));
      g.obstacles.forEach(o => occ2.add(`${o.x},${o.y}`));
      newFood = [...g.food.filter((_, i) => i !== ateFoodIdx), ...spawnItems(occ2, 1)];
    }

    // ── level up ──────────────────────────────────────────────────────────
    const oldLevel = g.level;
    const newLevel = Math.floor(newTick / LEVEL_UP_TICKS) + 1;
    const didLevelUp = newLevel > oldLevel;

    let newHunters = [...g.hunters];
    let newObstacles = [...g.obstacles];

    if (didLevelUp) {
      const occ3 = new Set(newSnake.map(p => `${p.x},${p.y}`));
      newHunters.forEach(h => occ3.add(`${h.pos.x},${h.pos.y}`));
      newObstacles.forEach(o => occ3.add(`${o.x},${o.y}`));
      newFood.forEach(f => occ3.add(`${f.x},${f.y}`));

      const ep = randomEdge(occ3);
      if (ep) {
        newHunters = [...newHunters, { id: nextIdRef.current++, pos: ep }];
        occ3.add(`${ep.x},${ep.y}`);
      }
      const newObs = spawnItems(occ3, OBSTACLE_PER_LEVEL);
      newObstacles = [...newObstacles, ...newObs];
    }

    // ── power-up spawn ─────────────────────────────────────────────────────
    let newPowerUps = g.powerUps.filter(pu => newTick - pu.spawnTick < POWERUP_LIFESPAN);

    if (newTick % POWERUP_SPAWN_INTERVAL === 0 && newPowerUps.length < POWERUP_MAX_ON_BOARD) {
      const occ4 = new Set(newSnake.map(p => `${p.x},${p.y}`));
      newHunters.forEach(h => occ4.add(`${h.pos.x},${h.pos.y}`));
      newObstacles.forEach(o => occ4.add(`${o.x},${o.y}`));
      newFood.forEach(f => occ4.add(`${f.x},${f.y}`));
      newPowerUps.forEach(pu => occ4.add(`${pu.pos.x},${pu.pos.y}`));
      const spots = spawnItems(occ4, 1);
      if (spots.length > 0) {
        newPowerUps = [
          ...newPowerUps,
          { id: nextPuIdRef.current++, pos: spots[0], kind: pickPowerUpType(), spawnTick: newTick },
        ];
      }
    }

    // ── power-up pickup ────────────────────────────────────────────────────
    let lastPickup: SoloPowerUpType | null = null;
    const pickedUp = newPowerUps.find(pu => pu.pos.x === newHead.x && pu.pos.y === newHead.y);
    if (pickedUp) {
      lastPickup = pickedUp.kind;
      newPowerUps = newPowerUps.filter(pu => pu.id !== pickedUp.id);
      switch (pickedUp.kind) {
        case 'freeze':
          newEffects.freezeTicks = 10;
          break;
        case 'shield':
          newEffects.shieldActive = true;
          break;
        case 'bomb':
          // Remove ALL hunters and obstacles within radius 7
          newHunters = newHunters.filter(h => {
            const dx = h.pos.x - newHead.x;
            const dy = h.pos.y - newHead.y;
            return Math.sqrt(dx * dx + dy * dy) > 7;
          });
          newObstacles = newObstacles.filter(o => {
            const dx = o.x - newHead.x;
            const dy = o.y - newHead.y;
            return Math.sqrt(dx * dx + dy * dy) > 7;
          });
          newScore += 5 * g.hunters.length; // bonus points for each hunter cleared
          break;
        case 'star':
          newEffects.starTicks = 20;
          break;
      }
    }

    // ── move hunters ──────────────────────────────────────────────────────
    const hInterval = hunterInterval(newLevel);
    if (newTick % hInterval === 0 && newEffects.freezeTicks === 0) {
      const bodySet = new Set(newSnake.map(p => `${p.x},${p.y}`));
      newObstacles.forEach(o => bodySet.add(`${o.x},${o.y}`));

      newHunters = newHunters.map(h => {
        const movOcc = new Set(bodySet);
        newHunters.forEach(oh => { if (oh.id !== h.id) movOcc.add(`${oh.pos.x},${oh.pos.y}`); });
        return { ...h, pos: stepHunter(h.pos, newHead, movOcc) };
      });

      // Hunter reached snake?
      if (newHunters.some(h => newSnake.some(s => s.x === h.pos.x && s.y === h.pos.y))) {
        if (newEffects.shieldActive) {
          newEffects.shieldActive = false;
          // push all colliding hunters back to where they were
          const collidingIds = new Set(
            newHunters
              .filter(h => newSnake.some(s => s.x === h.pos.x && s.y === h.pos.y))
              .map(h => h.id),
          );
          newHunters = newHunters.map(h =>
            collidingIds.has(h.id) ? { ...h, pos: g.hunters.find(gh => gh.id === h.id)?.pos ?? h.pos } : h,
          );
        } else {
          return endGame({ ...g, score: newScore });
        }
      }
    }

    const next: SoloState = {
      ...g,
      snake:        newSnake,
      dir,
      food:         newFood,
      hunters:      newHunters,
      obstacles:    newObstacles,
      powerUps:     newPowerUps,
      effects:      newEffects,
      level:        newLevel,
      score:        newScore,
      tick:         newTick,
      levelUpFlash: didLevelUp,
      lastPickup,
    };

    gameRef.current = next;
    setState(next);
  }, []);

  function endGame(g: SoloState) {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const hs = Math.max(g.score, hsRef.current);
    hsRef.current = hs;
    localStorage.setItem('arena_solo_hs', String(hs));
    const next: SoloState = { ...g, alive: false, highScore: hs };
    gameRef.current = next;
    setState(next);
  }

  const start = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const fresh = initialState(hsRef.current);
    fresh.alive   = true;
    fresh.started = true;
    gameRef.current = fresh;
    dirRef.current  = 'RIGHT';
    setState(fresh);
    timerRef.current = setInterval(tick, TICK_MS);
  }, [tick]);

  const setDirection = useCallback((d: Direction) => {
    dirRef.current = d;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return { state, start, setDirection };
}
