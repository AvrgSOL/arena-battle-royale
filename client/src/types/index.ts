export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type Vec2      = { x: number; y: number };

export interface SnakeState {
  id:     string;
  body:   Vec2[];
  dir:    Direction;
  alive:  boolean;
  score:  number;
  color:  string;
  wallet: string;
  name:   string;
}

export type PowerUpType = 'speed' | 'trim';
export interface PowerUp { pos: Vec2; kind: PowerUpType; }
export interface Zone { x1: number; y1: number; x2: number; y2: number; }

export interface GameState {
  tick:      number;
  snakes:    SnakeState[];
  food:      Vec2[];
  powerUps:  PowerUp[];
  obstacles: Vec2[];
  gridW:     number;
  gridH:     number;
  status:    'waiting' | 'countdown' | 'playing' | 'finished';
  zone?:     Zone;
}

export interface RoomSummary {
  id:         string;
  name:       string;
  entryFee:   number;
  players:    number;
  maxPlayers: number;
  status:     'waiting' | 'countdown' | 'playing' | 'finished';
  isPrivate:  boolean;
  mode:       'standard' | 'deathmatch';
}

export interface LobbyPlayer { id: string; name: string; wallet: string; color: string; }

export interface GameOverPayload {
  winnerId:   string | null;
  winnerName: string | null;
  pot:        number;
  burned:     number;
}

export type Page =
  | { name: 'landing' }
  | { name: 'lobby' }
  | { name: 'game';     roomId: string }
  | { name: 'spectate'; roomId: string }
  | { name: 'leaderboard' }
  | { name: 'store' }
  | { name: 'solo' };
