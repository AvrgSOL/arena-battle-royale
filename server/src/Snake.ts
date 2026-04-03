import { Direction, Vec2 } from './types';

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
};

const DELTA: Record<Direction, Vec2> = {
  UP:    { x: 0,  y: -1 },
  DOWN:  { x: 0,  y:  1 },
  LEFT:  { x: -1, y:  0 },
  RIGHT: { x: 1,  y:  0 },
};

export class Snake {
  id:         string;
  body:       Vec2[];
  dir:        Direction;
  alive:      boolean = true;
  score:      number  = 0;
  color:      string;
  wallet:     string;
  name:       string;
  pendingDir: Direction | null = null;

  constructor(id: string, start: Vec2, dir: Direction, color: string, wallet: string, name: string) {
    this.id     = id;
    this.dir    = dir;
    this.color  = color;
    this.wallet = wallet;
    this.name   = name;
    // Start with 3 segments
    const d = DELTA[dir];
    this.body = [
      { x: start.x,           y: start.y           },
      { x: start.x - d.x,     y: start.y - d.y     },
      { x: start.x - d.x * 2, y: start.y - d.y * 2 },
    ];
  }

  setDirection(dir: Direction): void {
    if (dir === OPPOSITE[this.dir]) return; // can't reverse
    this.pendingDir = dir;
  }

  applyPendingDirection(): void {
    if (this.pendingDir) {
      this.dir = this.pendingDir;
      this.pendingDir = null;
    }
  }

  nextHead(): Vec2 {
    const d = DELTA[this.dir];
    return { x: this.body[0].x + d.x, y: this.body[0].y + d.y };
  }

  step(grow: boolean): void {
    const head = this.nextHead();
    this.body.unshift(head);
    if (!grow) this.body.pop();
    else this.score++;
  }

  occupies(pos: Vec2): boolean {
    return this.body.some(s => s.x === pos.x && s.y === pos.y);
  }

  headAt(pos: Vec2): boolean {
    return this.body[0].x === pos.x && this.body[0].y === pos.y;
  }

  die(): void { this.alive = false; }
}
