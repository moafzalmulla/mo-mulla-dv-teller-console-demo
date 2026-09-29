"use client";

import { useId, useState, type FormEvent } from "react";
import { useBankStore } from "@/state/BankProvider";
import { MAX_CUSTOMER_NAME_LENGTH } from "@/domain/bank";
import { describeError } from "./messages";

export function OpenAccountForm() {
  const store = useBankStore();
  const inputId = useId();
  const errorId = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = store.openAccount(name);
    if (!result.ok) {
      setError(describeError(result.error));
      setConfirmation(null);
      return;
    }
    setName("");
    setError(null);
    setConfirmation(
      `Opened ${result.value.id} for ${result.value.customerName}.`,
    );
  }

  return (
    <form className="panel open-account" onSubmit={handleSubmit} noValidate>
      <h2 className="panel-title">Open an account</h2>
      <label htmlFor={inputId}>Customer name</label>
      <div className="field-row">
        <input
          id={inputId}
          name="customerName"
          autoComplete="off"
          value={name}
          maxLength={MAX_CUSTOMER_NAME_LENGTH + 20}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
        <button type="submit">Open account</button>
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
