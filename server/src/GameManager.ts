import WebSocket from 'ws';
import { v4 as uuid } from 'uuid';
import { GameRoom } from './GameRoom';
import { C2SMessage, S2CMessage, RoomSummary } from './types';
import { isTokenEnabled, verifyEntryPayment } from './token';

function send(ws: WebSocket, msg: S2CMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

export class GameManager {
  private rooms      = new Map<string, GameRoom>();
  private wsToRoom   = new Map<WebSocket, string>();
  private lobbyConns = new Set<WebSocket>(); // clients not in a room

  handleConnection(ws: WebSocket): void {
    this.lobbyConns.add(ws);
    send(ws, { type: 'ROOM_LIST', rooms: this.getRoomSummaries() });
  }

  handleMessage(ws: WebSocket, raw: string): void {
    let msg: C2SMessage;
    try { msg = JSON.parse(raw) as C2SMessage; } catch { return; }

    switch (msg.type) {
      case 'GET_ROOMS':
        send(ws, { type: 'ROOM_LIST', rooms: this.getRoomSummaries() });
        break;

      case 'GET_ROOM':
        send(ws, { type: 'ROOM_INFO', room: this.getRoomSummary(msg.roomId) ?? null });
        break;

      case 'CREATE_ROOM': {
        const { config, walletAddress, displayName } = msg;
        const MIN_ENTRY_FEE = 1_000 * 1_000_000; // 1000 ARENA in base units
        if (!config.name || config.maxPlayers < 2) {
          send(ws, { type: 'ERROR', message: 'Invalid room config' });
          return;
        }
        if (config.entryFee < MIN_ENTRY_FEE) {
          send(ws, { type: 'ERROR', message: 'Minimum entry fee is 1,000 ARENA' });
          return;
        }
        config.minPlayers = Math.max(2, Math.min(config.minPlayers ?? 2, config.maxPlayers));
        const id = uuid();
        const room = new GameRoom(id, config, () => {
          this.rooms.delete(id);
          this.broadcastRoomList();
        });
        this.rooms.set(id, room);
        this.lobbyConns.delete(ws);
        this.wsToRoom.set(ws, id);
        room.addPlayer(ws, walletAddress, displayName ?? 'Player');
        this.broadcastRoomList();
        break;
      }

      case 'JOIN_ROOM': {
        const room = this.rooms.get(msg.roomId);
        if (!room) { send(ws, { type: 'ERROR', message: 'Room not found' }); return; }
        // Verify ARENA token payment if token integration is enabled
        if (isTokenEnabled() && room.config.entryFee > 0) {
          verifyEntryPayment(msg.txSig, msg.walletAddress, room.config.entryFee).then(valid => {
            if (!valid) {
              send(ws, { type: 'ERROR', message: 'Entry payment not verified. Send the required ARENA tokens first.' });
              return;
            }
            try {
              this.lobbyConns.delete(ws);
              this.wsToRoom.set(ws, room.id);
              room.addPlayer(ws, msg.walletAddress, msg.displayName ?? 'Player');
              this.broadcastRoomList();
            } catch (e: any) {
              send(ws, { type: 'ERROR', message: e.message });
            }
          });
        } else {
          try {
            this.lobbyConns.delete(ws);
            this.wsToRoom.set(ws, room.id);
            room.addPlayer(ws, msg.walletAddress, msg.displayName ?? 'Player');
            this.broadcastRoomList();
          } catch (e: any) {
            send(ws, { type: 'ERROR', message: e.message });
          }
        }
        break;
      }

      case 'DIRECTION':
      case 'START_GAME': {
        const roomId = this.wsToRoom.get(ws);
        if (!roomId) return;
        this.rooms.get(roomId)?.handleMessage(ws, msg);
        break;
      }

      case 'SPECTATE': {
        const room = this.rooms.get(msg.roomId);
        if (!room) { send(ws, { type: 'ERROR', message: 'Room not found' }); return; }
        this.lobbyConns.delete(ws);
        room.addSpectator(ws);
        break;
      }

      case 'LEAVE': {
        const roomId = this.wsToRoom.get(ws);
        if (roomId) {
          this.rooms.get(roomId)?.removeClient(ws);
          this.wsToRoom.delete(ws);
          this.lobbyConns.add(ws);
          this.broadcastRoomList();
        }
        break;
      }
    }
  }

  handleClose(ws: WebSocket): void {
    const roomId = this.wsToRoom.get(ws);
    if (roomId) {
      this.rooms.get(roomId)?.removeClient(ws);
      this.wsToRoom.delete(ws);
    }
    this.lobbyConns.delete(ws);
    this.broadcastRoomList();
  }

  broadcastRoomList(): void {
    const msg: S2CMessage = { type: 'ROOM_LIST', rooms: this.getRoomSummaries() };
    const str = JSON.stringify(msg);
    for (const ws of this.lobbyConns) {
      if (ws.readyState === WebSocket.OPEN) ws.send(str);
    }
  }

  getRoomSummaries(): RoomSummary[] {
    return [...this.rooms.values()]
      .map(r => r.getSummary())
      .filter(r => !r.isPrivate);
  }

  getRoomSummary(roomId: string): RoomSummary | undefined {
    return this.rooms.get(roomId)?.getSummary();
  }
}
