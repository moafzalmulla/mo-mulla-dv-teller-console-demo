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
/** Cash over the counter. */
export type CashTransactionType = "deposit" | "withdrawal";
export type TransactionType = CashTransactionType | "transfer-out" | "transfer-in";

export interface Transaction {
  readonly id: TransactionId;
  readonly type: TransactionType;
  readonly amount: Cents;
  readonly balanceAfter: Cents;
  /** ISO-8601 timestamp. */
  readonly occurredAt: string;
  /** The other account in a transfer; absent for cash transactions. */
  readonly counterpartyAccountId?: AccountId;
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
  | { readonly code: "SAME_ACCOUNT_TRANSFER" }
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

/**
 * Moves money between two accounts as a single step: both legs are recorded
 * or neither is. Overdrafts are rejected with INSUFFICIENT_FUNDS.
 */
export function transfer(
  state: BankState,
  fromAccountId: AccountId,
  toAccountId: AccountId,
  amount: Cents,
  { createTransactionId, now }: TransactionContext,
): Result<BankState, BankError> {
  const from = findAccount(state, fromAccountId);
  if (!from) return err({ code: "ACCOUNT_NOT_FOUND", accountId: fromAccountId });
  const to = findAccount(state, toAccountId);
  if (!to) return err({ code: "ACCOUNT_NOT_FOUND", accountId: toAccountId });
  if (fromAccountId === toAccountId) return err({ code: "SAME_ACCOUNT_TRANSFER" });

  const invalid = validateAmount(from, "transfer-out", amount);
  if (invalid) return err(invalid);

  const occurredAt = now.toISOString();
  const debited = appendTransaction(from, {
    id: createTransactionId(),
    type: "transfer-out",
    amount,
    occurredAt,
    counterpartyAccountId: toAccountId,
  });
  const credited = appendTransaction(to, {
    id: createTransactionId(),
    type: "transfer-in",
    amount,
    occurredAt,
    counterpartyAccountId: fromAccountId,
  });

  return ok({
    ...state,
    accounts: state.accounts.map((a) =>
      a.id === fromAccountId ? debited : a.id === toAccountId ? credited : a,
    ),
  });
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
  type: CashTransactionType,
  amount: Cents,
  { createTransactionId, now }: TransactionContext,
): Result<BankState, BankError> {
  const account = findAccount(state, accountId);
  if (!account) return err({ code: "ACCOUNT_NOT_FOUND", accountId });

  const invalid = validateAmount(account, type, amount);
  if (invalid) return err(invalid);

  const updated = appendTransaction(account, {
    id: createTransactionId(),
    type,
    amount,
    occurredAt: now.toISOString(),
  });

  return ok({
    ...state,
    accounts: state.accounts.map((a) => (a.id === accountId ? updated : a)),
  });
}

function isDebit(type: TransactionType): boolean {
  return type === "withdrawal" || type === "transfer-out";
}

function validateAmount(
  account: Account,
  type: TransactionType,
  amount: Cents,
): BankError | undefined {
  // Callers should already have validated via parseAmount; this is the
  // domain's own invariant, not UI validation.
  if (amount <= 0) return { code: "NON_POSITIVE_AMOUNT" };

  if (isDebit(type) && amount > account.balance) {
    return {
      code: "INSUFFICIENT_FUNDS",
      available: account.balance,
      requested: amount,
    };
  }
  return undefined;
}

/** Applies an already-validated transaction and records the running balance. */
function appendTransaction(
  account: Account,
  transaction: Omit<Transaction, "balanceAfter">,
): Account {
  const balanceAfter = isDebit(transaction.type)
    ? subtractCents(account.balance, transaction.amount)
    : addCents(account.balance, transaction.amount);

  return {
    ...account,
    balance: balanceAfter,
    transactions: [...account.transactions, { ...transaction, balanceAfter }],
  };
}
