"use client";

import { createContext, useContext, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { BankState } from "@/domain/bank";
import { createBankStore, type BankStore } from "./bankStore";

const BankStoreContext = createContext<BankStore | null>(null);

interface BankProviderProps {
  children: ReactNode;
  /** Inject a pre-configured store (e.g. deterministic clock) in tests. */
  store?: BankStore;
}

export function BankProvider({ children, store }: BankProviderProps) {
  // Lazily create exactly one store per provider instance.
  const [ownStore] = useState(() => store ?? createBankStore());
  return (
    <BankStoreContext.Provider value={ownStore}>
      {children}
    </BankStoreContext.Provider>
  );
}

export function useBankStore(): BankStore {
  const store = useContext(BankStoreContext);
  if (!store) {
    throw new Error("useBankStore must be used within a <BankProvider>");
  }
  return store;
}

/** Subscribes the component to bank state; re-renders on every change. */
export function useBankState(): BankState {
  const store = useBankStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
