'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { fetchMe } from '@/lib/api';
import { adminNavGroups, adminNavIsActive, adminPageMeta } from '@/lib/admin-nav';
import { LayoutDashboard, LogOut, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthStore } from '@/store/authStore';

const SIDEBAR_WIDTH = 'w-60';

function userInitials(name: string | null | undefined, email: string): string {
  const base = name?.trim() || email;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      {adminNavGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = adminNavIsActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <Icon className="size-4 shrink-0 opacity-80" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SidebarBrand() {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
      <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <LayoutDashboard className="size-4" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">ThoughtExpense</p>
        <p className="truncate text-[11px] text-sidebar-foreground/55">Admin console</p>
      </div>
    </div>
  );
}

function SidebarFooter({
  email,
  name,
  onSignOut,
}: {
  email: string;
  name: string | null | undefined;
  onSignOut: () => void;
}) {
  return (
    <div className="shrink-0 space-y-2 border-t border-sidebar-border p-3">
      <div className="flex items-center gap-2.5 rounded-md px-1 py-1">
        <Avatar className="size-8">
          <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-accent-foreground">
            {userInitials(name, email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          {name ? <p className="truncate text-sm font-medium text-sidebar-foreground">{name}</p> : null}
          <p className="truncate text-xs text-sidebar-foreground/55">{email}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={onSignOut}
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
    </div>
  );
}

function DesktopSidebar({
  pathname,
  email,
  name,
  onSignOut,
}: {
  pathname: string;
  email: string;
  name: string | null | undefined;
  onSignOut: () => void;
}) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden h-svh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex',
        SIDEBAR_WIDTH
      )}
    >
      <SidebarBrand />
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <NavLinks pathname={pathname} />
      </nav>
      <SidebarFooter email={email} name={name} onSignOut={onSignOut} />
    </aside>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, setUser } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const page = adminPageMeta(pathname);

  useEffect(() => {
    if (user) return;
    fetchMe()
      .then((u) => setUser({ id: u.id, email: u.email, name: u.name ?? null }))
      .catch(() => {});
  }, [user, setUser]);

  function signOut() {
    logout();
    router.replace('/login');
  }

  const email = user?.email ?? '…';

  return (
    <div className="min-h-svh bg-muted/30">
      <DesktopSidebar pathname={pathname} email={email} name={user?.name} onSignOut={signOut} />

      <div className={cn('flex min-h-svh min-w-0 flex-col md:ml-60')}>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="icon-sm" className="md:hidden" aria-label="Open menu">
                  <Menu className="size-4" />
                </Button>
              }
            />
            <SheetContent side="left" className="w-[min(100vw-2rem,15rem)] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
              <SheetHeader className="border-b border-sidebar-border px-4 py-4 text-left">
                <SheetTitle className="text-sidebar-foreground">ThoughtExpense Admin</SheetTitle>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </nav>
              <div className="border-t border-sidebar-border p-3">
                <p className="truncate px-1 text-xs text-sidebar-foreground/55">{email}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full justify-start gap-2"
                  onClick={() => {
                    setMobileOpen(false);
                    signOut();
                  }}
                >
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{page.title}</p>
            {page.description ? (
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{page.description}</p>
            ) : null}
          </div>

          <ThemeToggle />
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
