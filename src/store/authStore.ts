'use client';

import { create } from 'zustand';
import { loadStoredToken, login as apiLogin, setAuthToken } from '@/lib/api';
import type { AdminUser } from '@/lib/types';

interface AuthState {
  user: AdminUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  setUser: (user: AdminUser | null) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  hydrate: () => {
    const t = loadStoredToken();
    if (t) setAuthToken(t);
    set({ ready: true });
  },
  setUser: (user) => set({ user }),
  login: async (email, password) => {
    const data = await apiLogin(email, password);
    set({
      user: {
        id: data.admin.id,
        email: data.admin.email,
        name: data.admin.name ?? null,
      },
    });
  },
  logout: () => {
    setAuthToken(null);
    set({ user: null });
  },
}));
