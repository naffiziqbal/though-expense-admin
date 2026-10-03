'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Skeleton } from '@/components/ui/skeleton';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, ready, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!ready) return;
    if (!user && !loadToken()) router.replace('/login');
  }, [ready, user, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user && !loadToken()) return null;

  return <>{children}</>;
}

function loadToken() {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('te_admin_token');
}
