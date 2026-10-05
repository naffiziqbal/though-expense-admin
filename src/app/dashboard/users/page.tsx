'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { fetchUsers } from '@/lib/api';
import type { UserAccessFilter, UserListItem } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

function moderationBadge(u: UserListItem) {
  if (u.accountStatus === 'banned') return <Badge variant="destructive">Banned</Badge>;
  if (u.accountStatus === 'suspended') return <Badge variant="outline">Suspended</Badge>;
  return null;
}

function planBadge(u: UserListItem) {
  if (!u.isPremium) return <Badge variant="secondary">Free</Badge>;
  if (u.premiumAccess === 'manual') {
    return (
      <Badge className="bg-violet-600 hover:bg-violet-600" title="Comp / manual premium">
        Premium · manual
      </Badge>
    );
  }
  if (u.premiumAccess === 'store') {
    return <Badge>Premium · store</Badge>;
  }
  return <Badge>Premium</Badge>;
}

const ACCESS_OPTIONS: { value: UserAccessFilter; label: string; hint: string }[] = [
  { value: 'all', label: 'All users', hint: 'Everyone' },
  { value: 'free', label: 'Free', hint: 'No premium access' },
  { value: 'premium', label: 'All premium', hint: 'Store + manual comp' },
  { value: 'paying', label: 'Paying (active store)', hint: 'RC/webhook path, valid period' },
  { value: 'store', label: 'Store / RC on file', hint: 'Any premium with product id' },
  { value: 'manual', label: 'Manual / comp', hint: 'Premium without store product' },
];

function parseAccess(raw: string | null): UserAccessFilter {
  if (raw === 'free' || raw === 'premium' || raw === 'manual' || raw === 'store' || raw === 'paying') {
    return raw;
  }
  return 'all';
}

function UsersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const access = parseAccess(searchParams.get('access'));
  const [items, setItems] = useState<UserListItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loadedKey, setLoadedKey] = useState('');
  const fetchKey = `${page}\0${query}\0${access}`;
  const loading = loadedKey !== fetchKey;

  function setAccessFilter(next: UserAccessFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'all') params.delete('access');
    else params.set('access', next);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    fetchUsers(page, query || undefined, access).then((data) => {
      if (cancelled) return;
      setItems(data.items);
      setPages(data.pagination.pages);
      setTotal(data.pagination.total);
      setLoadedKey(fetchKey);
    });
    return () => {
      cancelled = true;
    };
  }, [page, query, access, fetchKey]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          <strong>Paying</strong> = Play/App product on file and subscription still in period (RevenueCat webhook
          path). <strong>Manual</strong> = comp or paid offline — premium without a store product id.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <form
          className="flex min-w-[240px] flex-1 max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <Input
            placeholder="Search email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit">Search</Button>
        </form>
        <Select value={access} onValueChange={(v) => setAccessFilter(v as UserAccessFilter)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Access" />
          </SelectTrigger>
          <SelectContent>
            {ACCESS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {total.toLocaleString()} users · {ACCESS_OPTIONS.find((o) => o.value === access)?.hint}
      </p>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="rounded-md border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Expenses</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {moderationBadge(u)}
                        {planBadge(u)}
                      </div>
                    </TableCell>
                    <TableCell>{u._count.expenses}</TableCell>
                    <TableCell>{u._count.deviceTokens}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(u.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/users/${u.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {pages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <UsersPageContent />
    </Suspense>
  );
}
