import { format } from 'date-fns';
import type { AdminAuditLogRow } from './types';

export type AuditActionFilter = 'all' | AdminAuditLogRow['action'];

/** Filter dropdown labels (internal action keys stay in API). */
export const AUDIT_ACTION_FILTER_LABELS: Record<string, string> = {
  'user.update': 'Premium changes',
  'user.suspend': 'Suspensions',
  'user.ban': 'Bans',
  'user.reactivate': 'Restorations',
  'user.revoke_sessions': 'Session revokes',
  'billing.reconcile_stale_premium': 'Billing maintenance',
};

export function auditFilterLabel(action: string): string {
  return AUDIT_ACTION_FILTER_LABELS[action] ?? action;
}

/** Human label shown in the table Action column. */
export function auditActionLabel(row: AdminAuditLogRow): string {
  const { action, metadata } = row;
  switch (action) {
    case 'user.update': {
      if (metadata?.isPremium === true) return 'Granted premium';
      if (metadata?.isPremium === false) return 'Removed premium';
      return 'Updated subscription';
    }
    case 'user.suspend':
      return 'Suspended account';
    case 'user.ban':
      return 'Banned account';
    case 'user.reactivate':
      return 'Restored account';
    case 'user.revoke_sessions':
      return 'Signed out everywhere';
    case 'billing.reconcile_stale_premium':
      return 'Cleared stale premium';
    default:
      return action.replace(/[._]/g, ' ');
  }
}

export function auditActionVariant(
  action: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (action === 'user.ban' || action === 'user.suspend') return 'destructive';
  if (action === 'user.revoke_sessions') return 'secondary';
  if (action === 'billing.reconcile_stale_premium') return 'outline';
  if (action === 'user.update') return 'default';
  return 'default';
}

function formatPremiumUpdate(metadata: Record<string, unknown>): string {
  const parts: string[] = [];

  if (typeof metadata.isPremium === 'boolean') {
    parts.push(metadata.isPremium ? 'Premium enabled' : 'Premium disabled');
  }
  if (metadata.isPremium === true) {
    if (metadata.premiumUntil == null) {
      parts.push('Lifetime comp');
    } else if (metadata.premiumUntil) {
      const d = new Date(String(metadata.premiumUntil));
      if (!Number.isNaN(d.getTime())) {
        parts.push(`Until ${format(d, 'MMM d, yyyy')}`);
      }
    }
    if (metadata.premiumEmailSent === true) parts.push('Grant email sent');
    else if (metadata.premiumEmailSent === false) parts.push('No grant email');
  }

  if (metadata.subscriptionStatus !== undefined) {
    const st = metadata.subscriptionStatus;
    parts.push(`Subscription status → ${st === null ? 'cleared' : String(st)}`);
  }

  return parts.length > 0 ? parts.join(' · ') : '';
}

export function formatAuditDetailsSummary(row: AdminAuditLogRow): string {
  const { action, metadata, ipAddress } = row;
  if (!metadata || Object.keys(metadata).length === 0) {
    return ipAddress ? `From ${ipAddress}` : '—';
  }

  switch (action) {
    case 'user.update': {
      const s = formatPremiumUpdate(metadata);
      return s || compactJson(metadata);
    }
    case 'user.suspend':
    case 'user.ban':
    case 'user.reactivate': {
      const note = metadata.note;
      if (typeof note === 'string' && note.trim()) return note.trim();
      return '—';
    }
    case 'user.revoke_sessions': {
      const v = metadata.tokenVersion;
      return typeof v === 'number' ? `Token version ${v}` : 'All devices signed out';
    }
    case 'billing.reconcile_stale_premium': {
      const updated = metadata.updated;
      if (typeof updated === 'number') {
        return updated === 0 ? 'Nothing to clear' : `${updated} account(s) updated`;
      }
      return compactJson(metadata);
    }
    default:
      return compactJson(metadata);
  }
}

export function compactJson(metadata: Record<string, unknown>): string {
  return JSON.stringify(metadata);
}

export function formatAuditUser(row: AdminAuditLogRow): { primary: string; secondary: string | null; href: string | null } {
  if (row.targetType === 'system') {
    return { primary: 'All users (system)', secondary: null, href: null };
  }
  if (row.targetType === 'user' && row.targetId) {
    const u = row.targetUser;
    const href = `/dashboard/users/${row.targetId}`;
    if (u) {
      const primary = u.name?.trim() || u.email;
      const secondary = u.name?.trim() ? u.email : null;
      return { primary, secondary, href };
    }
    return { primary: 'Unknown user', secondary: row.targetId.slice(0, 8) + '…', href };
  }
  return { primary: row.targetType, secondary: row.targetId?.slice(0, 8) ?? null, href: null };
}
