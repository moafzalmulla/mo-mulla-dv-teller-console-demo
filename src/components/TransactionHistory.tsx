import type { Transaction } from "@/domain/bank";
import { formatCents } from "@/domain/money";

interface TransactionHistoryProps {
  transactions: readonly Transaction[];
}

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <p className="muted empty-history">
        No transactions yet. Deposits and withdrawals will be listed here.
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
              <td>{tx.type === "deposit" ? "Deposit" : "Withdrawal"}</td>
              <td className="num amount">
                {tx.type === "deposit" ? "+" : "−"}
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
