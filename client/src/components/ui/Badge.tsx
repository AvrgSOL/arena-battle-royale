type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'finished';

const statusConfig: Record<RoomStatus, { label: string; className: string }> = {
  waiting:   { label: 'WAITING',   className: 'bg-gray-700/50 text-gray-300 border-gray-600' },
  countdown: { label: 'STARTING',  className: 'bg-[#ffd54f]/10 text-[#ffd54f] border-[#ffd54f]/50' },
  playing:   { label: 'LIVE',      className: 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/50' },
  finished:  { label: 'FINISHED',  className: 'bg-[#9c6bff]/10 text-[#9c6bff] border-[#9c6bff]/50' },
};

export default function Badge({ status }: { status: RoomStatus }) {
  const { label, className } = statusConfig[status];
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border tracking-widest ${className}`}
    >
      {label}
    </span>
  );
}
