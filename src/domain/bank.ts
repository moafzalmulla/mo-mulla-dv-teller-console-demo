import { addCents, subtractCents, ZERO, type Cents } from "./money";
import { err, ok, type Result } from "./result";

/**
 * Pure domain model for the teller console. Every operation takes the current
 * state and returns a new state (or an error); nothing here mutates its input
 * or reaches for global time / randomness. IDs and timestamps are supplied by
 * the caller so behaviour is fully deterministic under test.
 */

export type AccountId = string;
export type TransactionId = string;
export type TransactionType = "deposit" | "withdrawal";

export interface Transaction {
  readonly id: TransactionId;
  readonly type: TransactionType;
  readonly amount: Cents;
  readonly balanceAfter: Cents;
  /** ISO-8601 timestamp. */
  readonly occurredAt: string;
}

export interface Account {
  readonly id: AccountId;
  readonly customerName: string;
  readonly balance: Cents;
  /** Oldest first; the order in which they were applied. */
  readonly transactions: readonly Transaction[];
  readonly openedAt: string;
}

export interface BankState {
  /** In the order they were opened. */
  readonly accounts: readonly Account[];
  readonly selectedAccountId: AccountId | null;
}

export type BankError =
  | { readonly code: "CUSTOMER_NAME_REQUIRED" }
  | { readonly code: "CUSTOMER_NAME_TOO_LONG"; readonly maxLength: number }
  | { readonly code: "DUPLICATE_ACCOUNT_ID"; readonly accountId: AccountId }
  | { readonly code: "ACCOUNT_NOT_FOUND"; readonly accountId: AccountId }
  | { readonly code: "NON_POSITIVE_AMOUNT" }
  | {
      readonly code: "INSUFFICIENT_FUNDS";
      readonly available: Cents;
      readonly requested: Cents;
    };

export const MAX_CUSTOMER_NAME_LENGTH = 100;

export const initialBankState: BankState = {
  accounts: [],
  selectedAccountId: null,
};

/**
 * IDs are produced by a callback that is only invoked once validation has
 * passed, so rejected attempts don't consume (and leave gaps in) the sequence.
 */
export interface OpenAccountContext {
  readonly createAccountId: () => AccountId;
  readonly now: Date;
}

export interface TransactionContext {
  readonly createTransactionId: () => TransactionId;
  readonly now: Date;
}

/** Opens a zero-balance account and makes it the selected account. */
export function openAccount(
  state: BankState,
  customerName: string,
  { createAccountId, now }: OpenAccountContext,
): Result<{ state: BankState; account: Account }, BankError> {
  const name = customerName.trim().replace(/\s+/g, " ");
  if (name === "") return err({ code: "CUSTOMER_NAME_REQUIRED" });
  if (name.length > MAX_CUSTOMER_NAME_LENGTH) {
    return err({
      code: "CUSTOMER_NAME_TOO_LONG",
      maxLength: MAX_CUSTOMER_NAME_LENGTH,
    });
  }
  const accountId = createAccountId();
  if (findAccount(state, accountId)) {
    return err({ code: "DUPLICATE_ACCOUNT_ID", accountId });
  }

  const account: Account = {
    id: accountId,
    customerName: name,
    balance: ZERO,
    transactions: [],
    openedAt: now.toISOString(),
  };

  return ok({
    account,
    state: {
      accounts: [...state.accounts, account],
      selectedAccountId: account.id,
    },
  });
}

export function deposit(
  state: BankState,
  accountId: AccountId,
  amount: Cents,
  context: TransactionContext,
): Result<BankState, BankError> {
  return applyTransaction(state, accountId, "deposit", amount, context);
}

/** Withdraws cash. Overdrafts are rejected with INSUFFICIENT_FUNDS. */
export function withdraw(
  state: BankState,
  accountId: AccountId,
  amount: Cents,
  context: TransactionContext,
): Result<BankState, BankError> {
  return applyTransaction(state, accountId, "withdrawal", amount, context);
}

export function selectAccount(
  state: BankState,
  accountId: AccountId,
): Result<BankState, BankError> {
  if (!findAccount(state, accountId)) {
    return err({ code: "ACCOUNT_NOT_FOUND", accountId });
  }
  return ok({ ...state, selectedAccountId: accountId });
}

export function findAccount(
  state: BankState,
  accountId: AccountId,
): Account | undefined {
  return state.accounts.find((account) => account.id === accountId);
}

export function getSelectedAccount(state: BankState): Account | undefined {
  return state.selectedAccountId === null
    ? undefined
    : findAccount(state, state.selectedAccountId);
}

function applyTransaction(
  state: BankState,
  accountId: AccountId,
  type: TransactionType,
  amount: Cents,
  { createTransactionId, now }: TransactionContext,
): Result<BankState, BankError> {
  const account = findAccount(state, accountId);
  if (!account) return err({ code: "ACCOUNT_NOT_FOUND", accountId });

  // Callers should already have validated via parseAmount; this is the
  // domain's own invariant, not UI validation.
  if (amount <= 0) return err({ code: "NON_POSITIVE_AMOUNT" });

  if (type === "withdrawal" && amount > account.balance) {
    return err({
      code: "INSUFFICIENT_FUNDS",
      available: account.balance,
      requested: amount,
    });
  }

  const balanceAfter =
    type === "deposit"
      ? addCents(account.balance, amount)
      : subtractCents(account.balance, amount);

  const updated: Account = {
    ...account,
    balance: balanceAfter,
    transactions: [
      ...account.transactions,
      {
        id: createTransactionId(),
        type,
        amount,
        balanceAfter,
        occurredAt: now.toISOString(),
      },
    ],
  };

  return ok({
    ...state,
    accounts: state.accounts.map((a) => (a.id === accountId ? updated : a)),
  });
}
