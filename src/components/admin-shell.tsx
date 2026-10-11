'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { ChevronsUpDown, LogOut, Menu, MonitorOff } from 'lucide-react';
import { adminNavGroups, adminNavIsActive } from '@/lib/admin-nav';
import { attentionByPath, useAttention } from '@/lib/attention';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { Confirm } from '@/components/console';
import { UserSearch } from '@/components/user-search';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-[#0E9488]', className)} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16l5-5 3.5 3.5L19 8" />
        <path d="M14 8h5v5" />
      </svg>
    </span>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const items = useAttention((s) => s.items);
  const counts = attentionByPath(items);

  return (
    <div className="flex flex-col gap-5">
      {adminNavGroups.map((group, gi) => (
        <div key={group.label ?? gi}>
          {group.label ? (
            <p className="mb-1 px-2.5 text-xs font-medium text-sidebar-foreground/55">{group.label}</p>
          ) : null}
          <ul className="flex flex-col gap-px">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = adminNavIsActive(pathname, href);
              const c = counts[href];
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
                      active
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[0_0_0_1px_var(--sidebar-border)]'
                        : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'opacity-70')} />
                    <span className="flex-1 truncate">{label}</span>
                    {c ? (
                      <span
                        className={cn(
                          'figure min-w-5 rounded-sm px-1 text-center text-[13px] leading-5',
                          c.tone === 'critical' ? 'bg-critical text-white dark:text-[#2a0d0a]' : 'bg-warn-soft text-warn'
                        )}
                        aria-label={`${c.n} need${c.n === 1 ? 's' : ''} attention`}
                      >
                        {c.n}
                      </span>
                    ) : null}
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

function AccountMenu({ onSignOut, onSignOutAll }: { onSignOut: () => void; onSignOutAll: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const email = user?.email ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent/60"
          />
        }
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold shadow-[0_0_0_1px_var(--sidebar-border)]">
          {email ? initials(user?.name, email) : ''}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user?.name || 'Admin'}</span>
          <span className="block truncate text-xs text-sidebar-foreground/60">{email}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={(v) => setTheme(String(v))}>
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">Match system</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSignOutAll}>
          <MonitorOff />
          Sign out on all devices
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarBody({
  pathname,
  onNavigate,
  onSignOut,
  onSignOutAll,
}: {
  pathname: string;
  onNavigate?: () => void;
  onSignOut: () => void;
  onSignOutAll: () => void;
}) {
  return (
    <>
      <Link href="/dashboard" onClick={onNavigate} className="flex h-14 shrink-0 items-center gap-2.5 px-4">
        <BrandMark />
        <span className="leading-tight">
          <span className="block text-sm font-semibold">ThoughtExpense</span>
          <span className="block text-xs text-sidebar-foreground/60">Console</span>
        </span>
      </Link>
      <nav aria-label="Console" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-3">
        <NavLinks pathname={pathname} onNavigate={onNavigate} />
      </nav>
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <AccountMenu onSignOut={onSignOut} onSignOutAll={onSignOutAll} />
      </div>
    </>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, logoutEverywhere } = useAuthStore();
  const startPolling = useAttention((s) => s.startPolling);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => startPolling(), [startPolling]);

  async function signOut() {
    await logout();
    router.replace('/login');
  }

  async function signOutEverywhere(): Promise<boolean> {
    try {
      await logoutEverywhere();
      toast.success('Signed out on all devices');
      router.replace('/login');
      return true;
    } catch {
      toast.error('Could not sign out other devices. Try again.');
      return false;
    }
  }

  const sidebarProps = {
    pathname,
    onSignOut: () => void signOut(),
    onSignOutAll: () => setConfirmAll(true),
  };

  return (
    <div className="min-h-svh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-58 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <SidebarBody {...sidebarProps} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex w-[min(100vw-3rem,16rem)] flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody {...sidebarProps} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-svh min-w-0 flex-col md:pl-58">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-sm md:px-8">
          <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu />
          </Button>
          <UserSearch />
        </header>

        <main id="main" className="flex-1 px-4 pt-8 pb-16 md:px-8">
          <div className="mx-auto w-full max-w-[1120px]">{children}</div>
        </main>
      </div>

      <Confirm
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Sign out on all devices?"
        description="Every browser signed in to this admin account, including this one, will need to sign in again."
        confirmLabel="Sign out everywhere"
        busyLabel="Signing out…"
        onConfirm={signOutEverywhere}
      />
    </div>
  );
}
