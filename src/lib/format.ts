import { format, formatDistanceToNowStrict } from 'date-fns';

const compactFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export function count(n: number): string {
  return n.toLocaleString('en');
}

export function compact(n: number): string {
  return compactFmt.format(n);
}

/** AI costs per user are fractions of a cent, so show enough precision to be useful. */
export function usd(n: number): string {
  if (!n) return '$0.00';
  if (n < 0) return `−${usd(-n)}`;
  if (n >= 0.1) return `$${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  if (n < 0.000001) return '<$0.000001';
  return `$${n.toFixed(6).replace(/0+$/, '')}`;
}

export function pct(part: number, whole: number): string {
  if (!whole) return '–';
  return `${Math.round((part / whole) * 100)}%`;
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return '–';
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  return format(new Date(iso), 'MMM d, yyyy, h:mm a');
}

export function date(iso: string | null | undefined): string {
  if (!iso) return '–';
  return format(new Date(iso), 'MMM d, yyyy');
}

export function shortTime(iso: string): string {
  return format(new Date(iso), 'MMM d, HH:mm');
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function duration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

export function initials(name: string | null | undefined, email: string): string {
  const base = name?.trim() || email;
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2 && name?.trim()) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

/** "subscription_status" → "Subscription status" */
export function humanize(raw: string): string {
  const s = raw.replace(/[._]/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const AI_KIND_LABELS: Record<string, string> = {
  parse: 'Expense parsing',
  parse_async: 'Expense parsing (background)',
  ocr: 'Receipt and document OCR',
  insights: 'Insights',
  briefing: 'Weekly briefing',
  advisor_ask: 'Advisor questions',
  advisor_why: 'Advisor explanations',
  advisor_savings: 'Advisor savings tips',
  search: 'Smart search',
  embedding: 'Embeddings (RAG)',
  budget_category: 'Budget parsing',
};

export function aiKindLabel(kind: string): string {
  return AI_KIND_LABELS[kind] ?? humanize(kind);
}

const QUEUE_LABELS: Record<string, string> = {
  'expense-parse': 'Expense parsing and imports',
  'category-budget-parse': 'Budget parsing',
  'weekly-briefing': 'Weekly briefing',
  'recurring-expenses': 'Recurring expenses',
  'ops-monitor': 'Alert monitor',
};

export function queueLabel(name: string): string {
  return QUEUE_LABELS[name] ?? humanize(name.replace(/-/g, ' '));
}
