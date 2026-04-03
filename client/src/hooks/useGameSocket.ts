import { useState, useEffect, useRef, useCallback } from 'react';
import { RoomSummary, GameState, LobbyPlayer, GameOverPayload } from '../types';
import { Direction } from '../types';

const WS_URL = 'ws://localhost:3002';

type C2SMessage =
  | { type: 'JOIN_ROOM';   roomId: string; walletAddress: string; txSig: string; displayName: string }
  | { type: 'CREATE_ROOM'; config: { name: string; entryFee: number; maxPlayers: number; minPlayers: number; mode?: 'standard' | 'deathmatch'; isPrivate?: boolean }; walletAddress: string; txSig: string; displayName: string }
  | { type: 'DIRECTION';   dir: Direction }
  | { type: 'SPECTATE';    roomId: string }
  | { type: 'START_GAME' }
  | { type: 'GET_ROOMS' }
  | { type: 'GET_ROOM';    roomId: string }
  | { type: 'LEAVE' };

export interface UseGameSocketReturn {
  rooms:        RoomSummary[];
  gameState:    GameState | null;
  lobbyPlayers: LobbyPlayer[];
  lobbyCountdown: number | null;
  gameOver:     GameOverPayload | null;
  playerId:     string | null;
  playerColor:  string | null;
  isCreator:     boolean;
  inviteRoom:    RoomSummary | null;
  currentRoomId: string | null;
  connected:    boolean;
  sendMessage:  (msg: C2SMessage) => void;
  joinRoom:     (roomId: string, displayName: string, walletAddress: string, txSig?: string) => void;
  createRoom:   (name: string, entryFee: number, maxPlayers: number, walletAddress: string, displayName: string, txSig?: string, mode?: 'standard' | 'deathmatch', isPrivate?: boolean) => void;
  sendDirection:(dir: Direction) => void;
  startGame:    () => void;
  getRooms:     () => void;
  getRoom:      (roomId: string) => void;
  leaveRoom:    () => void;
  spectateRoom: (roomId: string) => void;
}

export function useGameSocket(): UseGameSocketReturn {
  const wsRef       = useRef<WebSocket | null>(null);
  const reconnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmounted = useRef(false);
  const playerIdRef = useRef<string | null>(null);

  const [connected,      setConnected]      = useState(false);
  const [rooms,          setRooms]          = useState<RoomSummary[]>([]);
  const [gameState,      setGameState]      = useState<GameState | null>(null);
  const [lobbyPlayers,   setLobbyPlayers]   = useState<LobbyPlayer[]>([]);
  const [lobbyCountdown, setLobbyCountdown] = useState<number | null>(null);
  const [gameOver,       setGameOver]       = useState<GameOverPayload | null>(null);
  const [playerId,       setPlayerId]       = useState<string | null>(null);
  const [playerColor,    setPlayerColor]    = useState<string | null>(null);
  const [isCreator,      setIsCreator]      = useState(false);
  const [inviteRoom,     setInviteRoom]     = useState<RoomSummary | null>(null);
  const [currentRoomId,  setCurrentRoomId]  = useState<string | null>(null);

  const connect = useCallback(() => {
    if (isUnmounted.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isUnmounted.current) { ws.close(); return; }
      setConnected(true);
      ws.send(JSON.stringify({ type: 'GET_ROOMS' }));
    };

    ws.onmessage = (ev: MessageEvent) => {
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }

      switch (msg.type) {
        case 'ROOM_LIST':
          setRooms(msg.rooms);
          break;
        case 'ROOM_JOINED':
          setPlayerId(msg.playerId);
          playerIdRef.current = msg.playerId;
          setPlayerColor(msg.color);
          setCurrentRoomId(msg.roomId);
          setIsCreator(!!msg.isCreator);
          setGameOver(null);
          break;
        case 'LOBBY_STATE':
          setLobbyPlayers(msg.players);
          setLobbyCountdown(msg.countdown);
          // Update isCreator in case creator reassigned (e.g. original creator left)
          if (msg.creatorId) {
            setIsCreator(msg.creatorId === playerIdRef.current);
          }
          break;
        case 'ROOM_INFO':
          setInviteRoom(msg.room);
          break;
        case 'GAME_START':
          setGameState(msg.state);
          break;
        case 'GAME_TICK':
          setGameState(msg.state);
          break;
        case 'PLAYER_DIED':
          // state will be updated via next GAME_TICK
          break;
        case 'GAME_OVER':
          setGameOver({
            winnerId:   msg.winnerId,
            winnerName: msg.winnerName,
            pot:        msg.pot,
            burned:     msg.burned,
          });
          break;
        case 'ERROR':
          console.error('[Arena WS] server error:', msg.message);
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (!isUnmounted.current) {
        reconnTimer.current = setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    isUnmounted.current = false;
    connect();
    return () => {
      isUnmounted.current = true;
      if (reconnTimer.current) clearTimeout(reconnTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((msg: C2SMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const joinRoom = useCallback((
    roomId: string,
    displayName: string,
    walletAddress: string,
    txSig = 'free',
  ) => {
    sendMessage({ type: 'JOIN_ROOM', roomId, displayName, walletAddress, txSig });
  }, [sendMessage]);

  const createRoom = useCallback((
    name: string,
    entryFee: number,
    maxPlayers: number,
    walletAddress: string,
    displayName: string,
    txSig = 'free',
    mode: 'standard' | 'deathmatch' = 'standard',
    isPrivate = false,
  ) => {
    sendMessage({
      type: 'CREATE_ROOM',
      config: { name, entryFee, maxPlayers, minPlayers: 2, mode, isPrivate },
      walletAddress,
      displayName,
      txSig,
    });
  }, [sendMessage]);

  const startGame = useCallback(() => {
    sendMessage({ type: 'START_GAME' });
  }, [sendMessage]);

  const sendDirection = useCallback((dir: Direction) => {
    sendMessage({ type: 'DIRECTION', dir });
  }, [sendMessage]);

  const getRooms = useCallback(() => {
    sendMessage({ type: 'GET_ROOMS' });
  }, [sendMessage]);

  const getRoom = useCallback((roomId: string) => {
    sendMessage({ type: 'GET_ROOM', roomId });
  }, [sendMessage]);

  const leaveRoom = useCallback(() => {
    sendMessage({ type: 'LEAVE' });
    setGameState(null);
    setLobbyPlayers([]);
    setLobbyCountdown(null);
    setGameOver(null);
    setPlayerId(null);
    setPlayerColor(null);
    setIsCreator(false);
    setCurrentRoomId(null);
    playerIdRef.current = null;
  }, [sendMessage]);

  const spectateRoom = useCallback((roomId: string) => {
    sendMessage({ type: 'SPECTATE', roomId });
  }, [sendMessage]);

  return {
    rooms,
    gameState,
    lobbyPlayers,
    lobbyCountdown,
    gameOver,
    playerId,
    playerColor,
    isCreator,
    inviteRoom,
    currentRoomId,
    connected,
    sendMessage,
    joinRoom,
    createRoom,
    sendDirection,
    startGame,
    getRooms,
    getRoom,
    leaveRoom,
    spectateRoom,
  };
}
