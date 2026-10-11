import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  Gauge,
  Inbox,
  LineChart,
  Receipt,
  ScrollText,
  Server,
  Users,
} from 'lucide-react';

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type AdminNavGroup = {
  /** Omitted for the top group. */
  label?: string;
  items: AdminNavItem[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    items: [{ href: '/dashboard', label: 'Overview', icon: Inbox }],
  },
  {
    label: 'Customers',
    items: [
      { href: '/dashboard/users', label: 'Users', icon: Users },
      { href: '/dashboard/subscriptions', label: 'Subscriptions', icon: CreditCard },
      { href: '/dashboard/growth', label: 'Growth', icon: LineChart },
    ],
  },
  {
    label: 'Money',
    items: [{ href: '/dashboard/billing', label: 'Billing', icon: Receipt }],
  },
  {
    label: 'Platform',
    items: [
      { href: '/dashboard/operations', label: 'Operations', icon: Gauge },
      { href: '/dashboard/system', label: 'System', icon: Server },
      { href: '/dashboard/audit', label: 'Audit log', icon: ScrollText },
    ],
  },
];

export const adminNavFlat = adminNavGroups.flatMap((g) => g.items);

export function adminNavIsActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}
