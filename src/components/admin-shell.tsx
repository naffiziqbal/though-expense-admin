'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { fetchMe } from '@/lib/api';
import { adminNavGroups, adminNavIsActive, adminPageMeta } from '@/lib/admin-nav';
import { LayoutDashboard, LogOut, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthStore } from '@/store/authStore';

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      {adminNavGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-xs font-medium text-muted-foreground">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = adminNavIsActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
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

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-60 shrink-0 border-r bg-background md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 px-4 font-semibold">
          <LayoutDashboard className="size-5" />
          ThoughtExpense Admin
        </div>
        <Separator />
        <nav className="flex-1 overflow-y-auto p-3">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="border-t p-3">
          <p className="truncate px-3 text-xs text-muted-foreground">{user?.email ?? '…'}</p>
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="icon-sm" className="md:hidden" aria-label="Open menu">
                  <Menu className="size-4" />
                </Button>
              }
            />
            <SheetContent side="left" className="w-[min(100vw-2rem,16rem)] p-0">
              <SheetHeader className="border-b px-4 py-4 text-left">
                <SheetTitle>ThoughtExpense Admin</SheetTitle>
              </SheetHeader>
              <nav className="overflow-y-auto p-3">
                <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </nav>
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
