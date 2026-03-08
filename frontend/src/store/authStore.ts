import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Family } from '../types';

interface AuthState {
  user: User | null;
  family: Family | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isSessionExpired: boolean;

  setAuth: (data: { user: User; family: Family; access_token: string; refresh_token: string }) => void;
  clearAuth: () => void;
  updateUser: (userData: Partial<User>) => void;
  updateFamily: (familyData: Partial<Family>) => void;
  setSessionExpired: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      family: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isSessionExpired: false,

      setAuth: (data) => set({
        user: data.user,
        family: data.family,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        isAuthenticated: true,
        isSessionExpired: false,
      }),

      clearAuth: () => set({
        user: null,
        family: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isSessionExpired: false,
      }),

      updateUser: (userData) => set((state) => ({
        user: state.user ? { ...state.user, ...userData } : null,
      })),

      updateFamily: (familyData) => set((state) => ({
        family: state.family ? { ...state.family, ...familyData } : null,
      })),

      setSessionExpired: (v) => set({ isSessionExpired: v }),
    }),
    {
      name: 'kuberone-auth',
      partialize: (state) => ({
        user: state.user,
        family: state.family,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isSessionExpired: state.isSessionExpired,
      }),
    }
  )
);
