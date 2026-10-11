import type { AccountModerationStatus, PremiumAccess } from '@/lib/types';
import { Tag } from '@/components/console';

export function AccessTag({ isPremium, access }: { isPremium: boolean; access?: PremiumAccess }) {
  if (!isPremium) return <Tag>Free</Tag>;
  if (access === 'manual') return <Tag tone="teal" title="Granted in this console or paid outside the store">Manual premium</Tag>;
  if (access === 'store') return <Tag tone="teal" title="Billed through Google Play or the App Store">Store premium</Tag>;
  return <Tag tone="teal">Premium</Tag>;
}

export function AccountStatusTag({ status }: { status?: AccountModerationStatus }) {
  if (status === 'banned') return <Tag tone="critical" dot>Banned</Tag>;
  if (status === 'suspended') return <Tag tone="warn" dot>Suspended</Tag>;
  return null;
}
