import type { Transaction } from "@/domain/bank";
import { formatCents } from "@/domain/money";

interface TransactionHistoryProps {
  transactions: readonly Transaction[];
}

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

function describeType(tx: Transaction): string {
  switch (tx.type) {
    case "deposit":
      return "Deposit";
    case "withdrawal":
      return "Withdrawal";
    case "transfer-out":
      return `Transfer to ${tx.counterpartyAccountId}`;
    case "transfer-in":
      return `Transfer from ${tx.counterpartyAccountId}`;
  }
}

const isCredit = (tx: Transaction) =>
  tx.type === "deposit" || tx.type === "transfer-in";

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <p className="muted empty-history">
        No transactions yet. Deposits, withdrawals and transfers will be listed here.
      </p>
    );
  }

  // Newest first: the teller almost always wants the last thing that happened.
  const rows = [...transactions].reverse();

  return (
    <div className="table-scroll">
      <table className="ledger">
        <caption className="visually-hidden">
          Transactions, newest first
        </caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Type</th>
            <th scope="col" className="num">
              Amount
            </th>
            <th scope="col" className="num">
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => (
            <tr key={tx.id} data-type={tx.type}>
              <td>
                <time dateTime={tx.occurredAt}>
                  {dateTime.format(new Date(tx.occurredAt))}
                </time>
              </td>
              <td>{describeType(tx)}</td>
              <td className="num amount">
                {isCredit(tx) ? "+" : "−"}
                {formatCents(tx.amount)}
              </td>
              <td className="num amount">{formatCents(tx.balanceAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
