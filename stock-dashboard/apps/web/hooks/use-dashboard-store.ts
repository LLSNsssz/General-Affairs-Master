"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_SYMBOLS } from "@/lib/default-symbols";
import { normalizeRequest, quoteKey } from "@/lib/market/requests";
import type { QuoteRequest } from "@/lib/market/types";

type DashboardStore = {
  symbols: QuoteRequest[];
  search: string;
  selectedKey: string;
  setSearch: (value: string) => void;
  selectSymbol: (key: string) => void;
  addSymbol: (request: QuoteRequest) => void;
  removeSymbol: (key: string) => void;
};

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      symbols: DEFAULT_SYMBOLS.map(normalizeRequest),
      search: "",
      selectedKey: quoteKey(DEFAULT_SYMBOLS[0]),
      setSearch: (value) => set({ search: value }),
      selectSymbol: (key) => set({ selectedKey: key }),
      addSymbol: (request) => {
        const normalized = normalizeRequest(request);
        const nextKey = quoteKey(normalized);
        const hasSymbol = get().symbols.some((symbol) => quoteKey(symbol) === nextKey);

        if (hasSymbol) {
          return;
        }

        set((state) => ({
          symbols: [...state.symbols, normalized],
          selectedKey: nextKey,
        }));
      },
      removeSymbol: (key) => {
        const remaining = get().symbols.filter((symbol) => quoteKey(symbol) !== key);
        if (!remaining.length) {
          return;
        }

        set((state) => ({
          symbols: remaining,
          selectedKey:
            state.selectedKey === key ? quoteKey(remaining[0]) : state.selectedKey,
        }));
      },
    }),
    {
      name: "stock-dashboard-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        symbols: state.symbols,
        selectedKey: state.selectedKey,
      }),
    },
  ),
);
