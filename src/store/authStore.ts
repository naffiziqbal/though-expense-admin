'use client';

import { create } from 'zustand';
import {
  fetchMe,
  hasSession,
  login as apiLogin,
  logout as apiLogout,
  logoutEverywhere as apiLogoutEverywhere,
  setSession,
} from '@/lib/api';
import type { AdminUser } from '@/lib/types';

interface AuthState {
  user: AdminUser | null;
  ready: boolean;
  login: (email: string, password: string, totp?: string) => Promise<void>;
  setUser: (user: AdminUser | null) => void;
  /** Revoke this browser's session on the server and clear local state. */
  logout: () => Promise<void>;
  /** Revoke every session for this admin account. */
  logoutEverywhere: () => Promise<void>;
  /** Drop local auth state only (session already ended server-side). */
  clear: () => void;
  /** Validate the stored session against the API (refreshing tokens if needed). */
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  hydrate: async () => {
    if (!hasSession()) {
      // Drop any pre-rotation access token left behind (it can't be refreshed).
      setSession(null);
      set({ user: null, ready: true });
      return;
    }
    try {
      const u = await fetchMe();
      set({ user: { id: u.id, email: u.email, name: u.name ?? null }, ready: true });
    } catch {
      // A dead session is cleared by the API client (onSessionEnded); a network error keeps it.
      set({ ready: true });
    }
  },
  setUser: (user) => set({ user }),
  login: async (email, password, totp) => {
    const data = await apiLogin(email, password, totp);
    set({
      user: {
        id: data.admin.id,
        email: data.admin.email,
        name: data.admin.name ?? null,
      },
      ready: true,
    });
  },
  logout: async () => {
    set({ user: null });
    await apiLogout();
  },
  logoutEverywhere: async () => {
    await apiLogoutEverywhere();
    set({ user: null });
  },
  clear: () => set({ user: null }),
}));
