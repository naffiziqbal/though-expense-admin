import { format } from 'date-fns';
import type { AdminAuditLogRow } from './types';
import type { Tone } from '@/components/console';

/** Actions the API records, in the order they appear in the filter. */
export const AUDIT_ACTION_FILTERS: string[] = [
  'user.update',
  'user.suspend',
  'user.ban',
  'user.reactivate',
  'user.revoke_sessions',
  'billing.reconcile_stale_premium',
  'backup.download_link',
];

const FILTER_LABELS: Record<string, string> = {
  'user.update': 'Premium changes',
  'user.suspend': 'Suspensions',
  'user.ban': 'Bans',
  'user.reactivate': 'Reactivations',
  'user.revoke_sessions': 'Forced sign-outs',
  'billing.reconcile_stale_premium': 'Stale premium clean-ups',
  'backup.download_link': 'Backup downloads',
};

export function auditFilterLabel(action: string): string {
  return FILTER_LABELS[action] ?? action;
}

/** Short label for the action column. */
export function auditActionLabel(row: AdminAuditLogRow): string {
  const { action, metadata } = row;
  switch (action) {
    case 'user.update':
      if (metadata?.isPremium === true) return 'Granted premium';
      if (metadata?.isPremium === false) return 'Revoked premium';
      return 'Changed subscription';
    case 'user.suspend':
      return 'Suspended';
    case 'user.ban':
      return 'Banned';
    case 'user.reactivate':
      return 'Reactivated';
    case 'user.revoke_sessions':
      return 'Signed out everywhere';
    case 'billing.reconcile_stale_premium':
      return 'Cleared stale premium';
    case 'backup.download_link':
      return 'Downloaded a backup';
    default:
      return action.replace(/[._]/g, ' ');
  }
}

export function auditActionTone(action: string): Tone {
  if (action === 'user.ban' || action === 'backup.download_link') return 'critical';
  if (action === 'user.suspend') return 'warn';
  if (action === 'user.update' || action === 'user.reactivate') return 'teal';
  return 'neutral';
}

function premiumUpdateSummary(metadata: Record<string, unknown>): string {
  const parts: string[] = [];
  if (metadata.isPremium === true) {
    if (metadata.premiumUntil == null) parts.push('Lifetime, no end date.');
    else {
      const d = new Date(String(metadata.premiumUntil));
      if (!Number.isNaN(d.getTime())) parts.push(`Until ${format(d, 'MMM d, yyyy')}.`);
    }
    if (metadata.premiumEmailSent === true) parts.push('User was emailed.');
    else if (metadata.premiumEmailSent === false) parts.push('Email to user failed.');
  }
  if (metadata.subscriptionStatus !== undefined) {
    const st = metadata.subscriptionStatus;
    parts.push(st === null ? 'Subscription status cleared.' : `Subscription status set to ${String(st)}.`);
  }
  return parts.join(' ');
}

export function formatAuditDetailsSummary(row: AdminAuditLogRow): string {
  const { action, metadata } = row;
  if (!metadata || Object.keys(metadata).length === 0) return '–';

  switch (action) {
    case 'user.update':
      return premiumUpdateSummary(metadata) || compactJson(metadata);
    case 'user.suspend':
    case 'user.ban':
    case 'user.reactivate': {
      const note = metadata.note;
      return typeof note === 'string' && note.trim() ? `“${note.trim()}”` : 'No note.';
    }
    case 'user.revoke_sessions':
      return 'Every device signed out.';
    case 'billing.reconcile_stale_premium': {
      const updated = metadata.updated;
      if (typeof updated === 'number') return updated === 0 ? 'Nothing needed clearing.' : `${updated} accounts lost premium.`;
      return compactJson(metadata);
    }
    case 'backup.download_link': {
      const exp = typeof metadata.expiresAt === 'string' ? new Date(metadata.expiresAt) : null;
      return exp && !Number.isNaN(exp.getTime())
        ? `One-hour link, ${exp.getTime() < Date.now() ? 'expired' : 'expires'} ${format(exp, 'MMM d, HH:mm')}.`
        : 'One-hour download link.';
    }
    default:
      return compactJson(metadata);
  }
}

function compactJson(metadata: Record<string, unknown>): string {
  return JSON.stringify(metadata);
}

export function formatAuditUser(row: AdminAuditLogRow): { primary: string; secondary: string | null; href: string | null } {
  if (row.action === 'backup.download_link') {
    return { primary: 'Database backup', secondary: row.targetId?.split('/').pop() ?? null, href: null };
  }
  if (row.targetType === 'system') return { primary: 'All users', secondary: null, href: null };
  if (row.targetType === 'user' && row.targetId) {
    const u = row.targetUser;
    const href = `/dashboard/users/${row.targetId}`;
    if (u) {
      const name = u.name?.trim();
      return { primary: u.email, secondary: name || null, href };
    }
    return { primary: 'Deleted user', secondary: `${row.targetId.slice(0, 8)}…`, href };
  }
  return { primary: row.targetType, secondary: row.targetId?.slice(0, 8) ?? null, href: null };
}
