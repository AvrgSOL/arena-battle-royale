export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type Vec2      = { x: number; y: number };

export interface SnakeState {
  id:           string;
  body:         Vec2[];
  dir:          Direction;
  alive:        boolean;
  score:        number;
  color:        string;
  wallet:       string;
  name:         string;
  shielded?:    boolean;
  ghostTicks?:  number;
  frozenTicks?: number;
  magnetTicks?: number;
}

export type PowerUpType = 'speed' | 'trim' | 'shield' | 'ghost' | 'bomb' | 'freeze' | 'magnet';
export interface PowerUp { pos: Vec2; kind: PowerUpType; }
export interface Zone { x1: number; y1: number; x2: number; y2: number; }

export type GameEventType = 'food_frenzy' | 'speed_surge' | 'blackout';

export interface GameState {
  tick:         number;
  snakes:       SnakeState[];
  food:         Vec2[];
  powerUps:     PowerUp[];
  obstacles:    Vec2[];
  gridW:        number;
  gridH:        number;
  status:       'waiting' | 'countdown' | 'playing' | 'finished';
  zone?:        Zone;
  activeEvent?: GameEventType | null;
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
  potSol:     number | null;
  burned:     number;
  winStreak:  number;
}

export interface PrizePaidPayload {
  winnerId:  string;
  solAmount: number;
  txSig:     string;
}

export interface ChatMessage {
  playerId:   string;
  playerName: string;
  message:    string;
  timestamp:  number;
  isLobby?:   boolean;
}

export interface KillFeedEntry {
  id:         string;
  victimName: string;
  cause:      'wall' | 'snake' | 'self' | 'zone' | 'bomb';
  timestamp:  number;
}

export interface GameEventPayload {
  eventType: GameEventType;
  duration:  number;
  label:     string;
}

export type Page =
  | { name: 'landing' }
  | { name: 'lobby' }
  | { name: 'game';        roomId: string }
  | { name: 'spectate';    roomId: string }
  | { name: 'leaderboard' }
  | { name: 'store' }
  | { name: 'solo' };
