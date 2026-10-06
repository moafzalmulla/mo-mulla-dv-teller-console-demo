"use client";

import { useId, useState, type FormEvent } from "react";
import type { Account } from "@/domain/bank";
import { formatCents, NOT_AMOUNT_CHARS, parseAmount } from "@/domain/money";
import { useBankState, useBankStore } from "@/state/BankProvider";
import { describeError } from "./messages";

interface TransferFormProps {
  account: Account;
}

/**
 * Transfers money from the selected account to another customer's account.
 * Rendered as the Transfer tab of TransactionForm, which is keyed by account
 * ID, so switching customers clears a half-entered transfer.
 */
export function TransferForm({ account }: TransferFormProps) {
  const store = useBankStore();
  const { accounts } = useBankState();
  const recipientId = useId();
  const amountId = useId();
  const errorId = useId();
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const recipients = accounts.filter((a) => a.id !== account.id);

  function fail(message: string) {
    setError(message);
    setConfirmation(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipient = recipients.find((a) => a.id === toAccountId);
    if (!recipient) return fail("Choose an account to transfer to.");

    const parsed = parseAmount(amount);
    if (!parsed.ok) return fail(describeError(parsed.error));

    const result = store.transfer(account.id, recipient.id, parsed.value);
    if (!result.ok) return fail(describeError(result.error));

    setAmount("");
    setError(null);
    setConfirmation(
      `Transferred ${formatCents(parsed.value)} to ${recipient.customerName} (${recipient.id}).`,
    );
  }

  if (recipients.length === 0) {
    return (
      <p className="muted transfer-empty">
        Open another account to make a transfer.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor={recipientId}>To account</label>
      <select
        id={recipientId}
        name="toAccount"
        value={toAccountId}
        onChange={(event) => {
          setToAccountId(event.target.value);
          setError(null);
        }}
      >
        <option value="" disabled>
          Choose an account
        </option>
        {recipients.map((a) => (
          <option key={a.id} value={a.id}>
            {a.customerName} ({a.id})
          </option>
        ))}
      </select>

      <label htmlFor={amountId}>Transfer amount</label>
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
        <button type="submit" className="action-transfer">
          Transfer
        </button>
      </div>
      <p className="field-hint">
        Available to transfer: {formatCents(account.balance)}
      </p>
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
