// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  deposit,
  getSelectedAccount,
  initialBankState,
  MAX_CUSTOMER_NAME_LENGTH,
  openAccount,
  selectAccount,
  transfer,
  withdraw,
  type BankState,
} from "./bank";
import { cents } from "./money";
import type { Result } from "./result";

const NOW = new Date("2026-01-15T10:30:00.000Z");

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}

function withAccount(
  state: BankState = initialBankState,
  name = "Ada Lovelace",
  id = "ACC-0001",
): BankState {
  return unwrap(openAccount(state, name, { createAccountId: () => id, now: NOW }))
    .state;
}

let txCounter = 0;
const txContext = () => ({
  createTransactionId: () => `TXN-${++txCounter}`,
  now: NOW,
});

describe("openAccount", () => {
  it("creates a zero-balance account and selects it", () => {
    const { state, account } = unwrap(
      openAccount(initialBankState, "Ada Lovelace", {
        createAccountId: () => "ACC-0001",
        now: NOW,
      }),
    );

    expect(account).toEqual({
      id: "ACC-0001",
      customerName: "Ada Lovelace",
      balance: 0,
      transactions: [],
      openedAt: "2026-01-15T10:30:00.000Z",
    });
    expect(state.accounts).toEqual([account]);
    expect(state.selectedAccountId).toBe("ACC-0001");
  });

  it("normalises whitespace in the customer name", () => {
    const { account } = unwrap(
      openAccount(initialBankState, "  Grace   Hopper ", {
        createAccountId: () => "ACC-0001",
        now: NOW,
      }),
    );
    expect(account.customerName).toBe("Grace Hopper");
  });

  it("requires a name and does not consume an ID when it fails", () => {
    let idsIssued = 0;
    const result = openAccount(initialBankState, "   ", {
      createAccountId: () => `ACC-${++idsIssued}`,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, error: { code: "CUSTOMER_NAME_REQUIRED" } });
    expect(idsIssued).toBe(0);
  });

  it("limits name length", () => {
    const result = openAccount(
      initialBankState,
      "x".repeat(MAX_CUSTOMER_NAME_LENGTH + 1),
      { createAccountId: () => "ACC-0001", now: NOW },
    );
    expect(result).toEqual({
      ok: false,
      error: { code: "CUSTOMER_NAME_TOO_LONG", maxLength: MAX_CUSTOMER_NAME_LENGTH },
    });
  });

  it("guards against duplicate IDs", () => {
    const state = withAccount();
    expect(
      openAccount(state, "Someone Else", {
        createAccountId: () => "ACC-0001",
        now: NOW,
      }),
    ).toEqual({
      ok: false,
      error: { code: "DUPLICATE_ACCOUNT_ID", accountId: "ACC-0001" },
    });
  });

  it("allows two customers with the same name (IDs identify accounts)", () => {
    const state = withAccount(withAccount(), "Ada Lovelace", "ACC-0002");
    expect(state.accounts.map((a) => a.id)).toEqual(["ACC-0001", "ACC-0002"]);
  });

  it("does not mutate the previous state", () => {
    const before = initialBankState;
    withAccount(before);
    expect(before).toEqual({ accounts: [], selectedAccountId: null });
  });
});

describe("deposit", () => {
  it("increases the balance and records the transaction", () => {
    const state = unwrap(
      deposit(withAccount(), "ACC-0001", cents(12_345), {
        createTransactionId: () => "TXN-1",
        now: NOW,
      }),
    );
    const account = getSelectedAccount(state);

    expect(account?.balance).toBe(12_345);
    expect(account?.transactions).toEqual([
      {
        id: "TXN-1",
        type: "deposit",
        amount: 12_345,
        balanceAfter: 12_345,
        occurredAt: NOW.toISOString(),
      },
    ]);
  });

  it("only touches the target account", () => {
    const twoAccounts = withAccount(withAccount(), "Grace Hopper", "ACC-0002");
    const state = unwrap(deposit(twoAccounts, "ACC-0001", cents(500), txContext()));
    expect(state.accounts.map((a) => a.balance)).toEqual([500, 0]);
    expect(state.accounts[1]).toBe(twoAccounts.accounts[1]);
  });

  it("rejects unknown accounts", () => {
    expect(deposit(withAccount(), "ACC-9999", cents(100), txContext())).toEqual({
      ok: false,
      error: { code: "ACCOUNT_NOT_FOUND", accountId: "ACC-9999" },
    });
  });

  it.each([0, -100])("rejects non-positive amounts (%i)", (amount) => {
    expect(deposit(withAccount(), "ACC-0001", cents(amount), txContext())).toEqual({
      ok: false,
      error: { code: "NON_POSITIVE_AMOUNT" },
    });
  });
});

describe("withdraw", () => {
  const funded = () =>
    unwrap(deposit(withAccount(), "ACC-0001", cents(10_000), txContext()));

  it("decreases the balance and records running balance", () => {
    const state = unwrap(withdraw(funded(), "ACC-0001", cents(2_550), txContext()));
    const account = getSelectedAccount(state);
    expect(account?.balance).toBe(7_450);
    expect(account?.transactions.map((t) => [t.type, t.amount, t.balanceAfter])).toEqual([
      ["deposit", 10_000, 10_000],
      ["withdrawal", 2_550, 7_450],
    ]);
  });

  it("allows withdrawing the entire balance", () => {
    const state = unwrap(withdraw(funded(), "ACC-0001", cents(10_000), txContext()));
    expect(getSelectedAccount(state)?.balance).toBe(0);
  });

  it("rejects overdrafts without changing state or consuming an ID", () => {
    const before = funded();
    let idsIssued = 0;
    const result = withdraw(before, "ACC-0001", cents(10_001), {
      createTransactionId: () => `TXN-${++idsIssued}`,
      now: NOW,
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INSUFFICIENT_FUNDS", available: 10_000, requested: 10_001 },
    });
    expect(getSelectedAccount(before)?.transactions).toHaveLength(1);
    expect(idsIssued).toBe(0);
  });

  it("rejects any withdrawal from an empty account", () => {
    expect(withdraw(withAccount(), "ACC-0001", cents(1), txContext())).toMatchObject({
      ok: false,
      error: { code: "INSUFFICIENT_FUNDS" },
    });
  });
});

describe("transfer", () => {
  const funded = () =>
    unwrap(
      deposit(
        withAccount(withAccount(), "Grace Hopper", "ACC-0002"),
        "ACC-0001",
        cents(10_000),
        txContext(),
      ),
    );

  it("moves money between accounts and records both legs", () => {
    let n = 0;
    const state = unwrap(
      transfer(funded(), "ACC-0001", "ACC-0002", cents(2_500), {
        createTransactionId: () => `T${++n}`,
        now: NOW,
      }),
    );
    const [from, to] = state.accounts;

    expect(from?.balance).toBe(7_500);
    expect(to?.balance).toBe(2_500);
    expect(from?.transactions.at(-1)).toEqual({
      id: "T1",
      type: "transfer-out",
      amount: 2_500,
      balanceAfter: 7_500,
      occurredAt: "2026-01-15T10:30:00.000Z",
      counterpartyAccountId: "ACC-0002",
    });
    expect(to?.transactions).toEqual([
      {
        id: "T2",
        type: "transfer-in",
        amount: 2_500,
        balanceAfter: 2_500,
        occurredAt: "2026-01-15T10:30:00.000Z",
        counterpartyAccountId: "ACC-0001",
      },
    ]);
  });

  it("allows transferring the entire balance", () => {
    const state = unwrap(
      transfer(funded(), "ACC-0001", "ACC-0002", cents(10_000), txContext()),
    );
    expect(state.accounts.map((a) => a.balance)).toEqual([0, 10_000]);
  });

  it("rejects insufficient funds without changing state or consuming an ID", () => {
    const before = funded();
    let idsIssued = 0;
    const result = transfer(before, "ACC-0001", "ACC-0002", cents(10_001), {
      createTransactionId: () => `T${++idsIssued}`,
      now: NOW,
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INSUFFICIENT_FUNDS", available: 10_000, requested: 10_001 },
    });
    expect(idsIssued).toBe(0);
    expect(before.accounts.map((a) => a.balance)).toEqual([10_000, 0]);
  });

  it("rejects transfers to the same account", () => {
    expect(transfer(funded(), "ACC-0001", "ACC-0001", cents(100), txContext())).toEqual({
      ok: false,
      error: { code: "SAME_ACCOUNT_TRANSFER" },
    });
  });

  it.each([
    ["ACC-9999", "ACC-0002"],
    ["ACC-0001", "ACC-9999"],
  ])("rejects unknown accounts (%s -> %s)", (from, to) => {
    expect(transfer(funded(), from, to, cents(100), txContext())).toEqual({
      ok: false,
      error: { code: "ACCOUNT_NOT_FOUND", accountId: "ACC-9999" },
    });
  });

  it("rejects non-positive amounts", () => {
    expect(transfer(funded(), "ACC-0001", "ACC-0002", cents(0), txContext())).toEqual({
      ok: false,
      error: { code: "NON_POSITIVE_AMOUNT" },
    });
  });
});

describe("selectAccount", () => {
  it("switches the selected account", () => {
    const state = withAccount(withAccount(), "Grace Hopper", "ACC-0002");
    expect(state.selectedAccountId).toBe("ACC-0002");
    const switched = unwrap(selectAccount(state, "ACC-0001"));
    expect(getSelectedAccount(switched)?.customerName).toBe("Ada Lovelace");
  });

  it("rejects unknown accounts", () => {
    expect(selectAccount(withAccount(), "nope")).toEqual({
      ok: false,
      error: { code: "ACCOUNT_NOT_FOUND", accountId: "nope" },
    });
  });

  it("returns undefined when nothing is selected", () => {
    expect(getSelectedAccount(initialBankState)).toBeUndefined();
  });
});
