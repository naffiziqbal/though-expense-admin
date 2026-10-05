import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  Receipt,
  Server,
  Users,
  Workflow,
} from 'lucide-react';

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: 'Analytics',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, description: 'Key metrics at a glance' },
      { href: '/dashboard/growth', label: 'Growth', icon: BarChart3, description: 'Signup trends' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { href: '/dashboard/users', label: 'Users', icon: Users, description: 'Search and manage accounts' },
      {
        href: '/dashboard/subscriptions',
        label: 'Subscriptions',
        icon: CreditCard,
        description: 'Premium segments',
      },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { href: '/dashboard/billing', label: 'Billing ops', icon: Receipt, description: 'Webhooks and drift' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/dashboard/operations', label: 'Operations', icon: Workflow, description: 'AI, queues, integrations' },
      { href: '/dashboard/system', label: 'System', icon: Server, description: 'Health and dependencies' },
      { href: '/dashboard/audit', label: 'Audit log', icon: FileText, description: 'Admin actions' },
    ],
  },
];

export const adminNavFlat = adminNavGroups.flatMap((g) => g.items);

export function adminNavIsActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function adminPageMeta(pathname: string): { title: string; description?: string } {
  if (/^\/dashboard\/users\/[^/]+/.test(pathname)) {
    return { title: 'User detail', description: 'Account, billing, and usage' };
  }
  const match = adminNavFlat.find((item) => adminNavIsActive(pathname, item.href));
  if (match) return { title: match.label, description: match.description };
  return { title: 'Console' };
}
