"use client";

import { useId, useState, type FormEvent } from "react";
import type { AccountId, TransactionType } from "@/domain/bank";
import { formatCents, parseAmount } from "@/domain/money";
import { useBankStore } from "@/state/BankProvider";
import { describeError } from "./messages";

interface TransactionFormProps {
  accountId: AccountId;
}

// Anything a teller could legitimately type in an amount; letters and other
// symbols are dropped as they are typed or pasted.
const NOT_AMOUNT_CHARS = /[^\d.,£]/g;

const ACTIONS: Record<TransactionType, { label: string; done: string }> = {
  deposit: { label: "Deposit", done: "Deposited" },
  withdrawal: { label: "Withdraw", done: "Withdrew" },
};

/**
 * Deposit / withdraw cash for one account. The parent keys this component by
 * account ID so switching accounts resets the form rather than carrying a
 * half-entered amount across customers.
 */
export function TransactionForm({ accountId }: TransactionFormProps) {
  const store = useBankStore();
  const amountId = useId();
  const errorId = useId();
  const [type, setType] = useState<TransactionType>("deposit");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    <form className="transaction-form" onSubmit={handleSubmit} noValidate>
      <fieldset className="segmented">
        <legend className="visually-hidden">Transaction type</legend>
        {(Object.keys(ACTIONS) as TransactionType[]).map((option) => (
          <label key={option} className="segment">
            <input
              type="radio"
              name="transactionType"
              value={option}
              checked={type === option}
              onChange={() => {
                setType(option);
                setError(null);
              }}
            />
            <span>{option === "deposit" ? "Deposit" : "Withdrawal"}</span>
          </label>
        ))}
      </fieldset>

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
        <button type="submit" className={`action-${type}`}>
          {ACTIONS[type].label}
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
  );
}
