import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Page } from '../../types';
import { useSocket } from '../../context/GameSocketContext';
import { useArenaToken } from '../../hooks/useArenaToken';
import { truncateAddress, formatArena } from '../../lib/utils';
import { ARENA_DECIMALS } from '../../lib/token';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';

const SNAKE_COLORS = [
  '#00e5ff', '#9c6bff', '#00ff88', '#f472b6',
  '#ffd54f', '#ff4d6a', '#4ade80', '#fb923c',
];

interface Props {
  navigate:     (p: Page) => void;
  addToast:     (msg: string, variant?: 'info' | 'success' | 'error') => void;
  inviteRoomId?: string | null;
}

export default function LobbyPage({ navigate, addToast, inviteRoomId }: Props) {
  const { publicKey } = useWallet();
  const {
    rooms, connected, joinRoom, createRoom, getRooms, startGame, getRoom,
    lobbyPlayers, lobbyCountdown, gameState, playerId, isCreator, inviteRoom, currentRoomId,
  } = useSocket();
  const { balance, loading: payLoading, payEntry, isConfigured } = useArenaToken();

  const [showCreate,   setShowCreate]   = useState(false);
  const [showJoin,     setShowJoin]     = useState<string | null>(null);
  const [paying,       setPaying]       = useState(false);
  const [cPrivate,     setCPrivate]     = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Create form state
  const [cName,        setCName]        = useState('');
  const [cFee,         setCFee]         = useState('1000'); // in ARENA tokens (human units)
  const [cMax,         setCMax]         = useState('4');
  const [cMode,        setCMode]        = useState<'standard' | 'deathmatch'>('standard');

  // Join form state
  const [playerName,   setPlayerName]   = useState('');
  const [chosenColor,  setChosenColor]  = useState(SNAKE_COLORS[0]);

  // Auto-refresh rooms
  useEffect(() => {
    if (!connected) return;
    getRooms();
    const id = setInterval(getRooms, 5000);
    return () => clearInterval(id);
  }, [connected, getRooms]);

  // If opened via invite link, fetch that room and open the join modal
  useEffect(() => {
    if (inviteRoomId && connected) {
      getRoom(inviteRoomId);
    }
  }, [inviteRoomId, connected, getRoom]);

  useEffect(() => {
    if (inviteRoom && inviteRoomId) {
      setShowJoin(inviteRoomId);
    }
  }, [inviteRoom, inviteRoomId]);

  function copyInviteLink() {
    if (!currentRoomId) return;
    const inviteLink = `${window.location.origin}/?join=${currentRoomId}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    });
  }

  // Navigate to game as soon as countdown starts (so players see the canvas countdown)
  useEffect(() => {
    if (playerId && (lobbyCountdown !== null || gameState)) {
      navigate({ name: 'game', roomId: '' });
    }
  }, [lobbyCountdown, gameState, playerId, navigate]);

  const handleCreate = useCallback(async () => {
    if (!cName.trim()) { addToast('Room name required', 'error'); return; }
    if (!playerName.trim()) { addToast('Display name required', 'error'); return; }
    const feeNum = parseFloat(cFee) || 0;
    if (feeNum < 1000) { addToast('Minimum entry fee is 1,000 ARENA', 'error'); return; }
    const wallet = publicKey?.toBase58() ?? 'anonymous';
    // entryFee stored as base units (multiply human input by 10^6)
    const feeBaseUnits = Math.round((parseFloat(cFee) || 0) * 10 ** ARENA_DECIMALS);

    let txSig = 'free';
    if (isConfigured && feeBaseUnits > 0) {
      setPaying(true);
      try {
        txSig = await payEntry(feeBaseUnits);
      } catch (e: any) {
        addToast('Payment failed: ' + (e.message ?? 'unknown error'), 'error');
        setPaying(false);
        return;
      }
      setPaying(false);
    }

    const maxPlayers = cMode === 'deathmatch' ? 2 : parseInt(cMax, 10);
    createRoom(cName.trim(), feeBaseUnits, maxPlayers, wallet, playerName.trim(), txSig, cMode, cPrivate);
    setShowCreate(false);
    addToast('Room created! Waiting for players…', 'success');
  }, [cName, cFee, cMax, cMode, cPrivate, playerName, publicKey, createRoom, addToast, isConfigured, payEntry]);

  const handleJoin = useCallback(async () => {
    if (!playerName.trim()) { addToast('Display name required', 'error'); return; }
    if (!showJoin) return;
    const wallet = publicKey?.toBase58() ?? 'anonymous';

    const room = rooms.find(r => r.id === showJoin);
    const feeBaseUnits = room?.entryFee ?? 0;

    let txSig = 'free';
    if (isConfigured && feeBaseUnits > 0) {
      setPaying(true);
      try {
        txSig = await payEntry(feeBaseUnits);
      } catch (e: any) {
        addToast('Payment failed: ' + (e.message ?? 'unknown error'), 'error');
        setPaying(false);
        return;
      }
      setPaying(false);
    }

    joinRoom(showJoin, playerName.trim(), wallet, txSig);
    setShowJoin(null);
    addToast('Joined room! Waiting for countdown…', 'success');
  }, [showJoin, playerName, publicKey, joinRoom, addToast, rooms, isConfigured, payEntry]);

  return (
    <div className="min-h-full bg-[#050810] px-4 py-6 max-w-4xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ name: 'landing' })}
            className="text-gray-500 hover:text-white font-mono text-sm transition-colors"
          >
            ← BACK
          </button>
          <h2
            className="text-xl font-extrabold tracking-widest text-[#00e5ff]"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            LOBBY
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {isConfigured && publicKey && (
            <span className="text-xs font-mono text-[#f472b6]">
              {payLoading ? '…' : balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} ARENA
            </span>
          )}
          <span className={`text-xs font-mono ${connected ? 'text-[#00ff88]' : 'text-[#ff4d6a]'}`}>
            {connected ? '● CONNECTED' : '○ CONNECTING…'}
          </span>
          <Button size="sm" variant="primary" onClick={() => setShowCreate(true)}>
            + CREATE ROOM
          </Button>
        </div>
      </div>

      {/* Room list — only shown when not already in a room */}
      {lobbyPlayers.length === 0 && rooms.length === 0 && (
        <div className="text-center text-gray-500 font-mono py-20">
          No rooms yet. Create one to start!
        </div>
      )}
      {lobbyPlayers.length === 0 && rooms.length > 0 && (
        <div className="grid gap-3">
          {rooms.map(room => (
            <div
              key={room.id}
              className="bg-[#0b1120] border border-[#1a2840] rounded-lg p-4 flex items-center justify-between hover:border-[#1a3860] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="font-mono font-bold text-white text-sm">{room.name}</div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">
                    {truncateAddress(room.id)}
                  </div>
                </div>
                <Badge status={room.status} />
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-sm font-mono text-[#00e5ff]">
                    {room.players}/{room.maxPlayers}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">players</div>
                </div>
                <div className="text-center hidden sm:block">
                  <div className="text-sm font-mono text-[#f472b6]">
                    {formatArena(room.entryFee)}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">entry</div>
                </div>
                {room.status === 'waiting' ? (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={room.players >= room.maxPlayers}
                    onClick={() => setShowJoin(room.id)}
                  >
                    JOIN
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate({ name: 'spectate', roomId: room.id })}
                  >
                    WATCH
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lobby players (if in a room) */}
      {lobbyPlayers.length > 0 && (
        <div className="mt-6 bg-[#0b1120] border border-[#1a2840] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">
              In Room
              {lobbyCountdown !== null && (
                <span className="ml-3 text-[#ffd54f]">Starting in {lobbyCountdown}s</span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {currentRoomId && (
                <button
                  onClick={copyInviteLink}
                  className={`text-xs font-mono px-3 py-1.5 rounded border transition-colors ${
                    copiedInvite
                      ? 'bg-[#00ff88]/10 border-[#00ff88] text-[#00ff88]'
                      : 'bg-[#0b1120] border-[#1a2840] text-gray-400 hover:border-[#9c6bff] hover:text-[#9c6bff]'
                  }`}
                >
                  {copiedInvite ? '✓ Copied!' : '🔗 Invite Link'}
                </button>
              )}
              {isCreator && lobbyCountdown === null && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={startGame}
                >
                  ▶ START GAME
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {lobbyPlayers.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ background: p.color }}
                />
                <span className={`text-sm font-mono ${p.id === playerId ? 'text-[#00ff88]' : 'text-white'}`}>
                  {p.name}{p.id === playerId && isCreator ? ' 👑' : ''}
                </span>
              </div>
            ))}
          </div>
          {!isCreator && lobbyCountdown === null && (
            <p className="text-xs text-gray-500 font-mono mt-3">Waiting for the host to start…</p>
          )}
          {isCreator && lobbyPlayers.length < 2 && lobbyCountdown === null && (
            <p className="text-xs text-gray-500 font-mono mt-3">Share the invite link to add more players, or start solo.</p>
          )}
        </div>
      )}

      {/* Create Room Modal */}
      {showCreate && (
        <Modal title="CREATE ROOM" onClose={() => setShowCreate(false)}>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Your Display Name</span>
              <input
                className="bg-[#050810] border border-[#1a2840] rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#00e5ff]"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="SatoshiSnake"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Room Name</span>
              <input
                className="bg-[#050810] border border-[#1a2840] rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#00e5ff]"
                value={cName}
                onChange={e => setCName(e.target.value)}
                placeholder="Degen Arena"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Game Mode</span>
              <div className="flex gap-2">
                {(['standard', 'deathmatch'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setCMode(m)}
                    className={`flex-1 py-2 px-3 rounded border text-xs font-mono font-bold transition-colors ${
                      cMode === m
                        ? m === 'deathmatch'
                          ? 'bg-[#ff4d6a]/10 border-[#ff4d6a] text-[#ff4d6a]'
                          : 'bg-[#00e5ff]/10 border-[#00e5ff] text-[#00e5ff]'
                        : 'bg-[#050810] border-[#1a2840] text-gray-400 hover:border-[#2a3850]'
                    }`}
                  >
                    {m === 'deathmatch' ? '⚔️ 1v1 DEATH MATCH' : '🐍 STANDARD'}
                  </button>
                ))}
              </div>
              {cMode === 'deathmatch' && (
                <p className="text-xs text-[#ff4d6a] font-mono mt-1">
                  20×15 map · faster snakes · blockers · max 2 players
                </p>
              )}
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Entry Fee (ARENA tokens)</span>
              <input
                type="number"
                min="1000"
                step="500"
                className={`bg-[#050810] border rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#00e5ff] ${
                  parseFloat(cFee) < 1000 ? 'border-[#ff4d6a]' : 'border-[#1a2840]'
                }`}
                value={cFee}
                onChange={e => setCFee(e.target.value)}
              />
              <span className={`text-xs font-mono ${parseFloat(cFee) < 1000 ? 'text-[#ff4d6a]' : 'text-gray-600'}`}>
                Minimum 1,000 ARENA · set higher for bigger prize pools
              </span>
            </label>
            {cMode === 'standard' && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Max Players (2–8)</span>
                <input
                  type="number"
                  min="2"
                  max="8"
                  className="bg-[#050810] border border-[#1a2840] rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#00e5ff]"
                  value={cMax}
                  onChange={e => setCMax(e.target.value)}
                />
              </label>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Snake Color</span>
              <div className="flex gap-2 flex-wrap">
                {SNAKE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setChosenColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${chosenColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setCPrivate(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative ${cPrivate ? 'bg-[#9c6bff]' : 'bg-[#1a2840]'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${cPrivate ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs font-mono text-gray-400">
                {cPrivate ? '🔒 Private — invite link only' : '🌐 Public — listed in lobby'}
              </span>
            </label>
            <Button variant="primary" onClick={handleCreate} disabled={paying}>
              {paying ? 'SENDING ARENA…' : 'CREATE'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Join Room Modal */}
      {showJoin && (() => {
        const room = rooms.find(r => r.id === showJoin);
        const feeBaseUnits = room?.entryFee ?? 0;
        const feeDisplay = formatArena(feeBaseUnits);
        const insufficientBalance = isConfigured && feeBaseUnits > 0 && balance < feeBaseUnits / 1_000_000;
        return (
          <Modal title="JOIN ROOM" onClose={() => setShowJoin(null)}>
            <div className="flex flex-col gap-4">
              {feeBaseUnits > 0 && (
                <div className="bg-[#1a0820] border border-[#f472b644] rounded-lg p-3 text-sm font-mono">
                  <div className="text-[#f472b6]">Entry Fee: <strong>{feeDisplay}</strong></div>
                  {isConfigured && (
                    <div className={`text-xs mt-1 ${insufficientBalance ? 'text-[#ff4d6a]' : 'text-gray-500'}`}>
                      Your balance: {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} ARENA
                      {insufficientBalance && ' — insufficient'}
                    </div>
                  )}
                </div>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Display Name</span>
                <input
                  className="bg-[#050810] border border-[#1a2840] rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#00e5ff]"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  placeholder="SatoshiSnake"
                />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Snake Color (preference)</span>
                <div className="flex gap-2 flex-wrap">
                  {SNAKE_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setChosenColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${chosenColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-600 font-mono mt-1">Server assigns colors sequentially.</p>
              </div>
              <Button
                variant="primary"
                onClick={handleJoin}
                disabled={paying || insufficientBalance}
              >
                {paying ? 'SENDING ARENA…' : feeBaseUnits > 0 ? `PAY ${feeDisplay} & JOIN` : 'JOIN'}
              </Button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
