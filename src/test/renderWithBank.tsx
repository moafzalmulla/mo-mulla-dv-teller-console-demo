import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { BankProvider } from "@/state/BankProvider";
import { createBankStore, type BankStore } from "@/state/bankStore";
import { createSequentialIdGenerator } from "@/state/ids";

export function createTestStore(): BankStore {
  return createBankStore({
    now: () => new Date("2026-01-15T10:30:00.000Z"),
    nextAccountId: createSequentialIdGenerator("ACC", 4),
    nextTransactionId: createSequentialIdGenerator("TXN", 6),
  });
}

/** Renders UI inside a BankProvider backed by a deterministic store. */
export function renderWithBank(ui: ReactElement, store = createTestStore()) {
  const user = userEvent.setup();
  return {
    user,
    store,
    ...render(<BankProvider store={store}>{ui}</BankProvider>),
  };
}
