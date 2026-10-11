'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { fetchMe, hasSession, onSessionEnded, type SessionEndReason } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { BrandMark } from '@/components/admin-shell';

/** Re-check the session when the tab regains focus, at most this often. */
const REVALIDATE_MS = 60_000;

const END_MESSAGES: Record<SessionEndReason, string> = {
  expired: 'Your session expired or was revoked. Please sign in again.',
  signed_out: 'You have been signed out.',
  other_tab: 'You were signed out in another tab.',
};

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, ready, hydrate, clear, setUser } = useAuthStore();
  const lastCheck = useRef(0);

  useEffect(() => {
    lastCheck.current = Date.now();
    void hydrate();
  }, [hydrate]);

  // Forced logout: refresh failed (revoked/expired session) or another tab signed out.
  useEffect(
    () =>
      onSessionEnded((reason) => {
        clear();
        toast.error(END_MESSAGES[reason], { id: 'session-ended' });
        router.replace('/login');
      }),
    [clear, router]
  );

  // Catch server-side revocation (sign-out-everywhere, password reset) without waiting for a click.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible' || !hasSession()) return;
      if (Date.now() - lastCheck.current < REVALIDATE_MS) return;
      lastCheck.current = Date.now();
      fetchMe()
        .then((u) => setUser({ id: u.id, email: u.email, name: u.name ?? null }))
        .catch(() => {});
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [setUser]);

  const signedOut = ready && !user && !hasSession();

  useEffect(() => {
    if (signedOut) router.replace('/login');
  }, [signedOut, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8" aria-busy="true" aria-label="Checking your session">
        <BrandMark className="animate-pulse" />
      </div>
    );
  }

  if (signedOut) return null;

  return <>{children}</>;
}
