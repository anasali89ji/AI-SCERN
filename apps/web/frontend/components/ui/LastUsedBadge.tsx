import { formatDistanceToNow } from 'date-fns';

export function LastUsedBadge({ date }: { date: string | Date }) {
  const relative = formatDistanceToNow(new Date(date), { addSuffix: true });

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/15 border border-primary/25 text-primary-300">
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      {relative}
    </span>
  );
}
