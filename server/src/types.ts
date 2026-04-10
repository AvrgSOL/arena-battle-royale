export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type Vec2 = { x: number; y: number };

export interface SnakeState {
  id:           string;
  body:         Vec2[];
  dir:          Direction;
  alive:        boolean;
  score:        number;
  color:        string;
  wallet:       string;
  name:         string;
  isBot?:       boolean;
  shielded?:    boolean;
  ghostTicks?:  number;
  frozenTicks?: number;
  magnetTicks?: number;
}

export interface Zone { x1: number; y1: number; x2: number; y2: number; }

export type PowerUpType = 'speed' | 'trim' | 'shield' | 'ghost' | 'bomb' | 'freeze' | 'magnet';
export interface PowerUp { pos: Vec2; kind: PowerUpType; }

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

export interface RoomConfig {
  name:       string;
  entryFee:   number;
  maxPlayers: number;
  minPlayers: number;
  mode?:      'standard' | 'deathmatch';
  isPrivate?: boolean;
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

// Client → Server
export type C2SMessage =
  | { type: 'JOIN_ROOM';    roomId: string; walletAddress: string; txSig: string; displayName: string }
  | { type: 'CREATE_ROOM';  config: RoomConfig; walletAddress: string; txSig: string; displayName: string }
  | { type: 'DIRECTION';    dir: Direction }
  | { type: 'SPECTATE';     roomId: string }
  | { type: 'START_GAME' }
  | { type: 'GET_ROOMS' }
  | { type: 'GET_ROOM';     roomId: string }
  | { type: 'LEAVE' }
  | { type: 'CHAT';         message: string };

// Server → Client
export type S2CMessage =
  | { type: 'ROOM_LIST';    rooms: RoomSummary[] }
  | { type: 'ROOM_INFO';    room: RoomSummary | null }
  | { type: 'ROOM_JOINED';  roomId: string; playerId: string; color: string; isCreator: boolean }
  | { type: 'LOBBY_STATE';  players: LobbyPlayer[]; countdown: number | null; creatorId: string | null }
  | { type: 'GAME_START';   state: GameState }
  | { type: 'GAME_TICK';    state: GameState }
  | { type: 'PLAYER_DIED';  playerId: string; victimName: string; cause: 'wall' | 'snake' | 'self' | 'zone' | 'bomb' }
  | { type: 'GAME_OVER';    winnerId: string | null; winnerName: string | null; pot: number; potSol: number | null; burned: number; winStreak: number }
  | { type: 'PRIZE_PAID';   winnerId: string; solAmount: number; txSig: string }
  | { type: 'CHAT_MESSAGE'; playerId: string; playerName: string; message: string; timestamp: number; isLobby?: boolean }
  | { type: 'GAME_EVENT';   eventType: GameEventType; duration: number; label: string }
  | { type: 'ERROR';        message: string };

export interface LobbyPlayer {
  id:     string;
  name:   string;
  wallet: string;
  color:  string;
}
