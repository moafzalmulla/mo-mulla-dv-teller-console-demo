// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { cents } from "@/domain/money";
import { createBankStore } from "./bankStore";
import { createSequentialIdGenerator } from "./ids";

function createTestStore() {
  return createBankStore({
    now: () => new Date("2026-01-15T10:30:00.000Z"),
    nextAccountId: createSequentialIdGenerator("ACC", 4),
    nextTransactionId: createSequentialIdGenerator("TXN", 6),
  });
}

describe("bankStore", () => {
  it("runs a full teller session", () => {
    const store = createTestStore();

    const ada = store.openAccount("Ada Lovelace");
    expect(ada).toMatchObject({ ok: true, value: { id: "ACC-0001" } });

    store.deposit("ACC-0001", cents(5_000));
    store.withdraw("ACC-0001", cents(1_250));
    store.openAccount("Grace Hopper");
    store.deposit("ACC-0002", cents(100));

    const { accounts, selectedAccountId } = store.getState();
    expect(selectedAccountId).toBe("ACC-0002");
    expect(accounts.map((a) => [a.id, a.balance])).toEqual([
      ["ACC-0001", 3_750],
      ["ACC-0002", 100],
    ]);
    expect(accounts[1]?.transactions[0]?.id).toBe("TXN-000003");
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const store = createTestStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.openAccount("Ada Lovelace");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.deposit("ACC-0001", cents(100));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify or change state when an operation fails", () => {
    const store = createTestStore();
    store.openAccount("Ada Lovelace");
    const before = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);

    const result = store.withdraw("ACC-0001", cents(1));

    expect(result.ok).toBe(false);
    expect(store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("returns a stable state reference between changes (required by useSyncExternalStore)", () => {
    const store = createTestStore();
    expect(store.getState()).toBe(store.getState());
  });

  it("does not skip transaction IDs after a rejected withdrawal", () => {
    const store = createTestStore();
    store.openAccount("Ada Lovelace");
    store.withdraw("ACC-0001", cents(100)); // rejected
    store.deposit("ACC-0001", cents(100));
    expect(store.getState().accounts[0]?.transactions[0]?.id).toBe("TXN-000001");
  });
});
