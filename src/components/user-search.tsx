'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { fetchUsers } from '@/lib/api';
import type { UserListItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tag } from '@/components/console';

/** Top-bar lookup: type an email or name, jump straight to the account. Press / to focus. */
export function UserSearch() {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<UserListItem[]>([]);
  const [searchedFor, setSearchedFor] = useState('');
  const [active, setActive] = useState(0);
  const term = q.trim();
  const pending = term.length >= 2 && searchedFor !== term;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, [contenteditable="true"]');
      if ((e.key === '/' && !typing) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      fetchUsers(1, term, 'all', 6)
        .then((d) => {
          if (cancelled) return;
          setResults(d.items);
          setActive(0);
        })
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearchedFor(term));
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [term]);

  function go(href: string) {
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && term) {
      e.preventDefault();
      const hit = results[active];
      if (hit && active < results.length) go(`/dashboard/users/${hit.id}`);
      else go(`/dashboard/users?q=${encodeURIComponent(term)}`);
    }
  }

  const showList = open && term.length >= 2;

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Find a user by email or name"
        placeholder="Find a user by email or name"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-lg border border-input bg-card pr-10 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-sm border bg-muted px-1.5 text-[11px] text-muted-foreground sm:block">
        /
      </kbd>

      {showList ? (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border bg-popover shadow-lg shadow-black/5"
        >
          {pending ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No account matches “{term}”.</p>
          ) : (
            results.map((u, i) => (
              <button
                key={u.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(`/dashboard/users/${u.id}`)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left',
                  i === active && 'bg-accent'
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.email}</span>
                  {u.name ? <span className="block truncate text-xs text-muted-foreground">{u.name}</span> : null}
                </span>
                {u.accountStatus && u.accountStatus !== 'active' ? (
                  <Tag tone="critical">{u.accountStatus === 'banned' ? 'Banned' : 'Suspended'}</Tag>
                ) : u.isPremium ? (
                  <Tag tone="teal">Premium</Tag>
                ) : null}
              </button>
            ))
          )}
          {!pending ? (
            <button
              type="button"
              role="option"
              aria-selected={active === results.length}
              onMouseEnter={() => setActive(results.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(`/dashboard/users?q=${encodeURIComponent(term)}`)}
              className={cn(
                'block w-full border-t px-3 py-2 text-left text-sm text-muted-foreground',
                active === results.length && 'bg-accent text-foreground'
              )}
            >
              See all results for “{term}”
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
