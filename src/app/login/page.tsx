'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasSession } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { BrandMark } from '@/components/admin-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (e.g. a bookmarked /login): go straight to the console.
  useEffect(() => {
    if (hasSession()) router.replace('/dashboard');
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-background px-4">
      <main className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-16">
        <BrandMark className="size-10 rounded-[11px]" />
        <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.015em]">ThoughtExpense Console</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">Sign in with your admin account.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
              className="h-10 bg-card"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? 'login-error' : undefined}
              className="h-10 bg-card"
              required
            />
          </div>
          {error ? (
            <p id="login-error" role="alert" className="text-sm text-critical">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-10 w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-8 text-[13px] leading-relaxed text-muted-foreground">
          Admin accounts are separate from app accounts. To add one, run{' '}
          <code className="rounded-sm bg-muted px-1 py-0.5 text-[12px]">pnpm admin:create</code> on the API server.
        </p>
      </main>
    </div>
  );
}
