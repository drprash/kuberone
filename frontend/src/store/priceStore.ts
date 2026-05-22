import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MarketPrice } from '../types';

interface PriceState {
  priceMap: Record<string, MarketPrice>;
  fetchedAt: number | null;
  ttlMs: number;

  isCacheFresh: (neededSymbols: string[]) => boolean;
  setPrices: (prices: Record<string, MarketPrice>) => void;
  setTtl: (ms: number) => void;
  invalidate: () => void;
}

export const usePriceStore = create<PriceState>()(
  persist(
    (set, get) => ({
      priceMap: {},
      fetchedAt: null,
      ttlMs: 5 * 60 * 1000,

      isCacheFresh: (neededSymbols) => {
        const { fetchedAt, ttlMs, priceMap } = get();
        if (!fetchedAt) return false;
        if (Date.now() - fetchedAt > ttlMs) return false;
        return neededSymbols.every((s) => s.toUpperCase() in priceMap);
      },

      setPrices: (prices) =>
        set((state) => ({
          priceMap: { ...state.priceMap, ...prices },
          fetchedAt: Date.now(),
        })),

      setTtl: (ms) => set({ ttlMs: ms }),

      invalidate: () => set({ fetchedAt: null }),
    }),
    {
      name: 'kuberone-prices',
      partialize: (state) => ({ ttlMs: state.ttlMs }),
    }
  )
);
