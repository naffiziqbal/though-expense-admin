import { format } from 'date-fns';
import type { AdminAuditLogRow } from './types';

export type AuditActionFilter = 'all' | AdminAuditLogRow['action'];

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'user.update': 'User updated',
  'user.suspend': 'Suspended',
  'user.ban': 'Banned',
  'user.reactivate': 'Reactivated',
  'user.revoke_sessions': 'Sessions revoked',
  'billing.reconcile_stale_premium': 'Stale premium reconcile',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function auditActionVariant(
  action: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (action === 'user.ban' || action === 'user.suspend') return 'destructive';
  if (action === 'user.revoke_sessions') return 'secondary';
  if (action === 'billing.reconcile_stale_premium') return 'outline';
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

/** Short line for the table; falls back to compact JSON. */
export function formatAuditDetailsSummary(row: AdminAuditLogRow): string {
  const { action, metadata, ipAddress } = row;
  if (!metadata || Object.keys(metadata).length === 0) {
    return ipAddress ? `IP ${ipAddress}` : '—';
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
      if (typeof note === 'string' && note.trim()) return `Note: ${note.trim()}`;
      return 'No note';
    }
    case 'user.revoke_sessions': {
      const v = metadata.tokenVersion;
      return typeof v === 'number' ? `New token version ${v}` : 'All sessions invalidated';
    }
    case 'billing.reconcile_stale_premium': {
      const updated = metadata.updated;
      if (typeof updated === 'number') {
        return updated === 0 ? 'No stale flags cleared' : `Cleared premium on ${updated} user(s)`;
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

export function formatAuditTarget(row: AdminAuditLogRow): { label: string; href: string | null } {
  const shortId = row.targetId ? `${row.targetId.slice(0, 8)}…` : '';
  if (row.targetType === 'user' && row.targetId) {
    return { label: `user ${shortId}`, href: `/dashboard/users/${row.targetId}` };
  }
  if (row.targetType === 'system') {
    return { label: 'system', href: null };
  }
  return {
    label: row.targetId ? `${row.targetType} ${shortId}` : row.targetType,
    href: null,
  };
}
