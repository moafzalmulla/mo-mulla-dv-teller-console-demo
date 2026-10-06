import {
  deposit,
  initialBankState,
  openAccount,
  selectAccount,
  transfer,
  withdraw,
  type Account,
  type AccountId,
  type BankError,
  type BankState,
} from "@/domain/bank";
import type { Cents } from "@/domain/money";
import type { Result } from "@/domain/result";
import { createSequentialIdGenerator } from "./ids";

export interface BankStoreDependencies {
  readonly now: () => Date;
  readonly nextAccountId: () => AccountId;
  readonly nextTransactionId: () => string;
}

export interface BankStore {
  getState(): BankState;
  subscribe(listener: () => void): () => void;
  openAccount(customerName: string): Result<Account, BankError>;
  deposit(accountId: AccountId, amount: Cents): Result<BankState, BankError>;
  withdraw(accountId: AccountId, amount: Cents): Result<BankState, BankError>;
  transfer(
    fromAccountId: AccountId,
    toAccountId: AccountId,
    amount: Cents,
  ): Result<BankState, BankError>;
  selectAccount(accountId: AccountId): Result<BankState, BankError>;
}

export function createDefaultDependencies(): BankStoreDependencies {
  return {
    now: () => new Date(),
    nextAccountId: createSequentialIdGenerator("ACC", 4),
    nextTransactionId: createSequentialIdGenerator("TXN", 6),
  };
}

/**
 * A tiny observable store around the pure domain functions. It owns the
 * side effects (clock, ID generation) and returns results synchronously so
 * the UI can show validation errors inline. Designed for React's
 * useSyncExternalStore, but has no React dependency itself.
 */
export function createBankStore(
  deps: BankStoreDependencies = createDefaultDependencies(),
  initialState: BankState = initialBankState,
): BankStore {
  let state = initialState;
  const listeners = new Set<() => void>();

  const commit = (next: BankState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  const run = (
    result: Result<BankState, BankError>,
  ): Result<BankState, BankError> => {
    if (result.ok) commit(result.value);
    return result;
  };

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    openAccount(customerName) {
      const result = openAccount(state, customerName, {
        createAccountId: deps.nextAccountId,
        now: deps.now(),
      });
      if (!result.ok) return result;
      commit(result.value.state);
      return { ok: true, value: result.value.account };
    },

    deposit: (accountId, amount) =>
      run(
        deposit(state, accountId, amount, {
          createTransactionId: deps.nextTransactionId,
          now: deps.now(),
        }),
      ),

    withdraw: (accountId, amount) =>
      run(
        withdraw(state, accountId, amount, {
          createTransactionId: deps.nextTransactionId,
          now: deps.now(),
        }),
      ),

    transfer: (fromAccountId, toAccountId, amount) =>
      run(
        transfer(state, fromAccountId, toAccountId, amount, {
          createTransactionId: deps.nextTransactionId,
          now: deps.now(),
        }),
      ),

    selectAccount: (accountId) => run(selectAccount(state, accountId)),
  };
}
