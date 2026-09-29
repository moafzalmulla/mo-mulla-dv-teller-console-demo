"use client";

import { formatCents } from "@/domain/money";
import { useBankState, useBankStore } from "@/state/BankProvider";

export function AccountList() {
  const store = useBankStore();
  const { accounts, selectedAccountId } = useBankState();

  return (
    <nav className="panel accounts" aria-labelledby="accounts-heading">
      <h2 id="accounts-heading" className="panel-title">
        Accounts <span className="count">{accounts.length}</span>
      </h2>
      {accounts.length === 0 ? (
        <p className="muted">Open an account to start serving a customer.</p>
      ) : (
        <ul className="account-list">
          {accounts.map((account) => {
            const selected = account.id === selectedAccountId;
            return (
              <li key={account.id}>
                <button
                  type="button"
                  className="account-item"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => store.selectAccount(account.id)}
                >
                  <span className="account-item-name">
                    {account.customerName}
                  </span>
                  <span className="account-item-meta">
                    <span>{account.id}</span>
                    <span className="amount">
                      {formatCents(account.balance)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
