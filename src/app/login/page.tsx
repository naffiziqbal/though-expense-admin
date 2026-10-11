'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasSession, LoginError } from '@/lib/api';
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
  const [code, setCode] = useState('');
  /** Password accepted; the account has two-factor sign-in, so ask for a code. */
  const [needsCode, setNeedsCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Already signed in (e.g. a bookmarked /login): go straight to the console.
  useEffect(() => {
    if (hasSession()) router.replace('/dashboard');
  }, [router]);

  useEffect(() => {
    if (needsCode) codeRef.current?.focus();
  }, [needsCode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password, needsCode ? code : undefined);
      router.replace('/dashboard');
    } catch (err) {
      setLoading(false);
      if (err instanceof LoginError && err.code === 'totp_required') {
        setNeedsCode(true);
        return;
      }
      if (err instanceof LoginError && err.code === 'totp_invalid') setCode('');
      setError(err instanceof Error ? err.message : 'Sign in failed. Try again.');
    }
  }

  function startOver() {
    setNeedsCode(false);
    setCode('');
    setPassword('');
    setError(null);
  }

  return (
    <div className="flex min-h-svh flex-col bg-background px-4">
      <main className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-16">
        <BrandMark className="size-10 rounded-[11px]" />
        <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.015em]">ThoughtExpense Console</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          {needsCode ? `Enter the 6-digit code from your authenticator app for ${email.trim()}.` : 'Sign in with your admin account.'}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {needsCode ? (
            <div className="space-y-1.5">
              <Label htmlFor="code">Authenticator code</Label>
              <Input
                id="code"
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
                className="figure h-12 bg-card text-center text-2xl tracking-[0.3em]"
                required
              />
            </div>
          ) : (
            <>
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
            </>
          )}
          {error ? (
            <p id="login-error" role="alert" className="text-sm text-critical">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-10 w-full" disabled={loading}>
            {loading ? 'Signing in…' : needsCode ? 'Verify and sign in' : 'Sign in'}
          </Button>
          {needsCode ? (
            <button type="button" onClick={startOver} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
              Use a different account
            </button>
          ) : null}
        </form>

        <p className="mt-8 text-[13px] leading-relaxed text-muted-foreground">
          {needsCode ? (
            <>
              Lost your authenticator? Someone with server access can reset it with{' '}
              <code className="rounded-sm bg-muted px-1 py-0.5 text-[12px]">pnpm admin:totp</code>.
            </>
          ) : (
            <>
              Admin accounts are separate from app accounts. To add one, run{' '}
              <code className="rounded-sm bg-muted px-1 py-0.5 text-[12px]">pnpm admin:create</code> on the API server.
            </>
          )}
        </p>
      </main>
    </div>
  );
}
