import { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../../context/GameSocketContext';

export default function ChatPanel() {
  const { chatMessages, sendChat, playerId } = useSocket();
  const [open, setOpen]       = useState(false);
  const [draft, setDraft]     = useState('');
  const [unread, setUnread]   = useState(0);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const prevLenRef            = useRef(chatMessages.length);

  // Track unread when panel is closed
  useEffect(() => {
    if (!open && chatMessages.length > prevLenRef.current) {
      setUnread(n => n + (chatMessages.length - prevLenRef.current));
    }
    prevLenRef.current = chatMessages.length;
  }, [chatMessages.length, open]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, chatMessages.length]);

  const submit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    sendChat(text);
    setDraft('');
  }, [draft, sendChat]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Chat window */}
      {open && (
        <div className="w-72 bg-[#0b1120] border border-[#1a2840] rounded-xl shadow-2xl flex flex-col overflow-hidden"
             style={{ height: 340 }}>
          <div className="px-3 py-2 border-b border-[#1a2840] font-mono text-xs text-gray-400 uppercase tracking-widest">
            Chat
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
            {chatMessages.length === 0 && (
              <div className="text-xs text-gray-600 font-mono text-center mt-4">No messages yet</div>
            )}
            {chatMessages.map((msg, i) => {
              const isMe = msg.playerId === playerId;
              return (
                <div key={i} className={`text-xs font-mono leading-snug ${isMe ? 'text-right' : ''}`}>
                  <span className={`font-bold ${isMe ? 'text-[#00ff88]' : 'text-[#00e5ff]'}`}>
                    {isMe ? 'You' : msg.playerName}
                  </span>
                  {msg.isLobby && (
                    <span className="text-gray-600 text-[10px] ml-1">[lobby]</span>
                  )}
                  <span className="text-gray-300 ml-1.5 break-words">{msg.message}</span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={submit} className="p-2 border-t border-[#1a2840] flex gap-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              maxLength={200}
              placeholder="Say something…"
              className="flex-1 bg-[#050810] border border-[#1a2840] rounded px-2 py-1 text-xs font-mono text-white placeholder:text-gray-600 outline-none focus:border-[#00e5ff]"
            />
            <button type="submit"
              className="text-xs font-mono px-2 py-1 bg-[#00e5ff] text-black rounded font-bold hover:bg-[#00ccee] disabled:opacity-40"
              disabled={!draft.trim()}>
              ↵
            </button>
          </form>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-10 h-10 rounded-full bg-[#0b1120] border border-[#1a2840] flex items-center justify-center text-lg hover:border-[#00e5ff] transition-colors shadow-lg"
      >
        💬
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff4d6a] text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
