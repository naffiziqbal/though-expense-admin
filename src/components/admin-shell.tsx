'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { fetchMe } from '@/lib/api';
import {
  Activity,
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Receipt,
  Server,
  Users,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/authStore';

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/growth', label: 'Growth', icon: BarChart3 },
  { href: '/dashboard/users', label: 'Users', icon: Users },
  { href: '/dashboard/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/dashboard/billing', label: 'Billing ops', icon: Receipt },
  { href: '/dashboard/operations', label: 'Operations', icon: Workflow },
  { href: '/dashboard/audit', label: 'Audit log', icon: FileText },
  { href: '/dashboard/system', label: 'System', icon: Server },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, setUser } = useAuthStore();

  useEffect(() => {
    if (user) return;
    fetchMe()
      .then((u) => setUser({ id: u.id, email: u.email, name: u.name ?? null }))
      .catch(() => {});
  }, [user, setUser]);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 shrink-0 border-r bg-background md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 px-4 font-semibold">
          <Activity className="size-5 text-primary" />
          ThoughtExpense Admin
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <p className="truncate px-3 text-xs text-muted-foreground">{user?.email}</p>
          <Button
            variant="ghost"
            className="mt-2 w-full justify-start gap-2"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <header className="flex h-14 items-center border-b bg-background px-4 md:px-8">
          <p className="text-sm text-muted-foreground">SaaS operations console</p>
        </header>
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
