'use client';

import { cn } from '@/lib/utils';

/** Small segmented control for picking a window: 7, 30 or 90 days by default. */
export function RangeTabs<T extends string | number>({
  value,
  onChange,
  options = [7, 30, 90] as unknown as T[],
  label = (v) => `${v} days`,
  ariaLabel = 'Time range',
}: {
  value: T;
  onChange: (v: T) => void;
  options?: T[];
  label?: (v: T) => string;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex gap-0.5 rounded-lg border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={cn(
            'h-7 rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors',
            value === o ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}
