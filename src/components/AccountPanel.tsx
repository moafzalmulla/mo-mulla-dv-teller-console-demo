import type { Account } from "@/domain/bank";
import { formatCents } from "@/domain/money";
import { TransactionForm } from "./TransactionForm";
import { TransactionHistory } from "./TransactionHistory";

interface AccountPanelProps {
  account: Account;
}

export function AccountPanel({ account }: AccountPanelProps) {
  return (
    <section className="account-panel" aria-labelledby="account-heading">
      <header className="account-header">
        <div>
          <h2 id="account-heading" className="account-name">
            {account.customerName}
          </h2>
          <p className="account-id">Account {account.id}</p>
        </div>
        <div className="balance">
          <span className="balance-label" id="balance-label">
            Balance
          </span>
          <output
            className="balance-value amount"
            aria-labelledby="balance-label"
            aria-live="polite"
          >
            {formatCents(account.balance)}
          </output>
        </div>
      </header>

      <TransactionForm key={account.id} account={account} />

      <h3 className="section-title">Transactions</h3>
      <TransactionHistory transactions={account.transactions} />
    </section>
  );
}
