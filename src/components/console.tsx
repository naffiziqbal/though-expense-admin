'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { count } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Page structure
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  back,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="mb-3 inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            {back.label}
          </Link>
        ) : null}
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-[68ch] text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({
  id,
  title,
  description,
  actions,
  children,
  flush,
  className,
}: {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Body has no padding (tables run edge to edge). */
  flush?: boolean;
  className?: string;
}) {
  return (
    <section id={id} className={cn('scroll-mt-20', className)}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 max-w-[72ch] text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn('overflow-hidden rounded-xl border bg-card', !flush && 'p-5')}>{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

export function Figure({
  label,
  value,
  note,
  tone,
  size = 'md',
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: 'warn' | 'critical' | 'ok';
  size?: 'md' | 'lg';
}) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'figure mt-1.5',
          size === 'lg' ? 'text-[44px]' : 'text-[32px]',
          tone === 'warn' && 'text-warn',
          tone === 'critical' && 'text-critical',
          tone === 'ok' && 'text-ok'
        )}
      >
        {value}
      </p>
      {note ? <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** A row of figures divided by rules, like totals across a ledger page. */
export function FigureStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]',
        className
      )}
    >
      {Array.isArray(children)
        ? children.map((c, i) => (
            <div key={i} className="bg-card px-5 py-4">
              {c}
            </div>
          ))
        : <div className="bg-card px-5 py-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type Tone = 'ok' | 'warn' | 'critical' | 'neutral' | 'teal';

const TONE_TAG: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  critical: 'bg-critical-soft text-critical',
  neutral: 'bg-secondary text-muted-foreground',
  teal: 'bg-teal-soft text-primary',
};

const TONE_DOT: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  critical: 'bg-critical',
  neutral: 'bg-muted-foreground/60',
  teal: 'bg-primary',
};

export function Tag({ tone = 'neutral', children, dot, title }: { tone?: Tone; children: React.ReactNode; dot?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap',
        TONE_TAG[tone]
      )}
    >
      {dot ? <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', TONE_DOT[tone])} aria-hidden />;
}

/** Inline callout with a tone rule on the left. */
export function Notice({
  tone = 'warn',
  title,
  children,
  action,
  className,
}: {
  tone?: Exclude<Tone, 'neutral'>;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const rule = { ok: 'border-l-ok', warn: 'border-l-warn', critical: 'border-l-critical', teal: 'border-l-primary' }[tone];
  return (
    <div
      role={tone === 'critical' ? 'alert' : undefined}
      className={cn('flex flex-col gap-3 rounded-lg border border-l-[3px] bg-card px-4 py-3 sm:flex-row sm:items-center', rule, className)}
    >
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Load states
// ---------------------------------------------------------------------------

export function LoadError({ message, onRetry, what }: { message: string; onRetry?: () => void; what: string }) {
  return (
    <Notice
      tone="critical"
      title={`Couldn't load ${what}`}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw />
            Try again
          </Button>
        ) : undefined
      }
    >
      {message}
    </Notice>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-[52ch] text-sm text-muted-foreground">{children}</p> : null}
    </div>
  );
}

export function Rows({ n = 5, className }: { n?: number; className?: string }) {
  return (
    <div className={cn('space-y-2 p-5', className)}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function RefreshButton({ onClick, busy, label = 'Refresh' }: { onClick: () => void; busy?: boolean; label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={busy}>
      <RefreshCw className={cn(busy && 'animate-spin')} />
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

export function Fields({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn('divide-y', className)}>{children}</dl>;
}

export function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 text-sm break-words', mono && 'font-mono text-[13px]')}>{children}</dd>
    </div>
  );
}

export function Pager({
  page,
  pages,
  total,
  limit,
  onPage,
  noun = 'rows',
}: {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
  noun?: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-sm text-muted-foreground">
      <span className="num">
        {total === 0 ? `No ${noun}` : `${count(from)}–${count(to)} of ${count(total)} ${noun}`}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft />
        </Button>
        <span className="num px-1 text-xs">
          {page} / {Math.max(1, pages)}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busyLabel,
  destructive,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  destructive?: boolean;
  /** Return false to keep the dialog open (e.g. on failure). */
  onConfirm: () => Promise<boolean | void>;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const ok = await onConfirm();
                if (ok !== false) onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? (busyLabel ?? `${confirmLabel}…`) : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
