"use client";

import { useId, useState, type FormEvent } from "react";
import type { Account, CashTransactionType } from "@/domain/bank";
import { formatCents, NOT_AMOUNT_CHARS, parseAmount } from "@/domain/money";
import { useBankStore } from "@/state/BankProvider";
import { describeError } from "./messages";
import { TransferForm } from "./TransferForm";

interface TransactionFormProps {
  account: Account;
}

const ACTIONS: Record<CashTransactionType, { label: string; done: string }> = {
  deposit: { label: "Deposit", done: "Deposited" },
  withdrawal: { label: "Withdraw", done: "Withdrew" },
};

type Tab = CashTransactionType | "transfer";

const TABS: Record<Tab, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  transfer: "Transfer",
};

/**
 * Deposit / withdraw / transfer for one account, chosen with a segmented
 * control. The parent keys this component by account ID so switching accounts
 * resets the form rather than carrying a half-entered amount across customers.
 */
export function TransactionForm({ account }: TransactionFormProps) {
  const accountId = account.id;
  const store = useBankStore();
  const amountId = useId();
  const errorId = useId();
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    type: CashTransactionType,
  ) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (!parsed.ok) {
      setError(describeError(parsed.error));
      setConfirmation(null);
      return;
    }
    const result =
      type === "deposit"
        ? store.deposit(accountId, parsed.value)
        : store.withdraw(accountId, parsed.value);
    if (!result.ok) {
      setError(describeError(result.error));
      setConfirmation(null);
      return;
    }
    setAmount("");
    setError(null);
    setConfirmation(`${ACTIONS[type].done} ${formatCents(parsed.value)}.`);
  }

  return (
    <div className="transaction-form">
      <fieldset className="segmented">
        <legend className="visually-hidden">Transaction type</legend>
        {(Object.keys(TABS) as Tab[]).map((option) => (
          <label key={option} className="segment">
            <input
              type="radio"
              name="transactionType"
              value={option}
              checked={tab === option}
              onChange={() => {
                setTab(option);
                setError(null);
              }}
            />
            <span>{TABS[option]}</span>
          </label>
        ))}
      </fieldset>

      {tab === "transfer" ? (
        <TransferForm account={account} />
      ) : (
        <form onSubmit={(event) => handleSubmit(event, tab)} noValidate>
          <label htmlFor={amountId}>Amount</label>
          <div className="field-row">
            <div className="currency-input">
              <span aria-hidden="true">£</span>
              <input
                id={amountId}
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => {
                  setAmount(event.target.value.replace(NOT_AMOUNT_CHARS, ""));
                  setError(null);
                }}
              />
            </div>
            <button type="submit" className={`action-${tab}`}>
              {ACTIONS[tab].label}
            </button>
          </div>
          {error && (
            <p id={errorId} className="field-error" role="alert">
              {error}
            </p>
          )}
          <p className="field-status" role="status">
            {confirmation}
          </p>
        </form>
      )}
    </div>
  );
}
