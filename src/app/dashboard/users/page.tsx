'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { fetchUsers } from '@/lib/api';
import { count, date } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import type { UserAccessFilter } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Empty, LoadError, PageHeader, Pager, Rows } from '@/components/console';
import { AccessTag, AccountStatusTag } from '@/components/user-tags';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const LIMIT = 20;

const ACCESS_OPTIONS: { value: UserAccessFilter; label: string; hint: string }[] = [
  { value: 'all', label: 'Everyone', hint: 'All accounts' },
  { value: 'free', label: 'Free', hint: 'No premium access' },
  { value: 'premium', label: 'Premium', hint: 'Store and manual premium' },
  { value: 'paying', label: 'Paying', hint: 'Store subscription inside its paid period' },
  { value: 'store', label: 'Store on file', hint: 'Premium with a store product, including lapsed periods' },
  { value: 'manual', label: 'Manual', hint: 'Premium without a store product: comps and offline payments' },
];

function parseAccess(raw: string | null): UserAccessFilter {
  return ACCESS_OPTIONS.some((o) => o.value === raw) ? (raw as UserAccessFilter) : 'all';
}

function UsersPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const access = parseAccess(params.get('access'));
  const query = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [draft, setDraft] = useState(query);
  const [lastQuery, setLastQuery] = useState(query);

  // Keep the box in sync when the URL changes from elsewhere (top-bar search, back button).
  if (query !== lastQuery) {
    setLastQuery(query);
    setDraft(query);
  }

  function setParams(next: { q?: string; access?: UserAccessFilter; page?: number }) {
    const p = new URLSearchParams(params.toString());
    const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k));
    if (next.q !== undefined) set('q', next.q.trim() || null);
    if (next.access !== undefined) set('access', next.access === 'all' ? null : next.access);
    set('page', next.page && next.page > 1 ? String(next.page) : null);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Search as you type, debounced.
  useEffect(() => {
    if (draft.trim() === query) return;
    const t = window.setTimeout(() => setParams({ q: draft }), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const list = useLoad(() => fetchUsers(page, query || undefined, access, LIMIT), `${page}|${query}|${access}`);
  const hint = ACCESS_OPTIONS.find((o) => o.value === access)?.hint;

  return (
    <>
      <PageHeader title="Users" description="Look up an account to check its plan, usage and billing history, or to take action on it." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Email or name"
            aria-label="Search users by email or name"
            className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none"
          />
        </div>
        <div
          role="group"
          aria-label="Filter by access"
          className="flex w-full gap-1 overflow-x-auto rounded-lg border bg-card p-1 lg:w-auto"
        >
          {ACCESS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={access === o.value}
              title={o.hint}
              onClick={() => setParams({ access: o.value })}
              className={cn(
                'h-7 shrink-0 rounded-md px-2.5 text-sm whitespace-nowrap transition-colors',
                access === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {access !== 'all' ? <p className="mb-3 text-[13px] text-muted-foreground">{hint}.</p> : null}

      {list.error ? (
        <LoadError what="users" message={list.error} onRetry={list.reload} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {list.loading || !list.data ? (
            <Rows n={8} />
          ) : list.data.items.length === 0 ? (
            <Empty title={query ? `No users match “${query}”` : 'No users in this group'}>
              {query ? 'Check the spelling, or search by part of the email address.' : 'Try another filter above.'}
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Devices</TableHead>
                  <TableHead className="hidden sm:table-cell">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((u) => (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a')) return;
                      router.push(`/dashboard/users/${u.id}`);
                    }}
                  >
                    <TableCell className="max-w-[22rem]">
                      <Link href={`/dashboard/users/${u.id}`} className="block truncate font-medium hover:underline">
                        {u.email}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">{u.name || 'No name'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="flex gap-1.5">
                        <AccountStatusTag status={u.accountStatus} />
                        <AccessTag isPremium={u.isPremium} access={u.premiumAccess} />
                      </span>
                    </TableCell>
                    <TableCell className="num text-right">{count(u._count.expenses)}</TableCell>
                    <TableCell className="num hidden text-right md:table-cell">{count(u._count.deviceTokens)}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{date(u.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {list.data ? (
            <Pager
              page={page}
              pages={list.data.pagination.pages}
              total={list.data.pagination.total}
              limit={LIMIT}
              noun="users"
              onPage={(p) => setParams({ page: p })}
            />
          ) : null}
        </div>
      )}
    </>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<Rows n={8} />}>
      <UsersPageContent />
    </Suspense>
  );
}
