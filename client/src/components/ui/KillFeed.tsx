import { useEffect, useState } from 'react';
import { KillFeedEntry } from '../../types';

const CAUSE_ICON: Record<string, string> = {
  wall:  '🧱',
  snake: '🐍',
  self:  '💀',
  zone:  '☠️',
  bomb:  '💣',
};

const CAUSE_TEXT: Record<string, string> = {
  wall:  'hit a wall',
  snake: 'got eaten',
  self:  'ate themselves',
  zone:  'left the zone',
  bomb:  'got bombed',
};

interface Props {
  entries: KillFeedEntry[];
}

export default function KillFeed({ entries }: Props) {
  const [visible, setVisible] = useState<KillFeedEntry[]>([]);

  useEffect(() => {
    setVisible(entries.slice(0, 5));
  }, [entries]);

  if (!visible.length) return null;

  return (
    <div className="pointer-events-none flex flex-col gap-1">
      {visible.map((entry, i) => (
        <div
          key={entry.id}
          className="flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded"
          style={{
            background: 'rgba(5, 8, 16, 0.7)',
            opacity: Math.max(0.35, 1 - i * 0.18),
          }}
        >
          <span>{CAUSE_ICON[entry.cause] ?? '💀'}</span>
          <span className="text-[#ff4d6a] font-bold">{entry.victimName}</span>
          <span className="text-gray-400">{CAUSE_TEXT[entry.cause] ?? 'died'}</span>
        </div>
      ))}
    </div>
  );
}
