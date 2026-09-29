"use client";

import { getSelectedAccount } from "@/domain/bank";
import { useBankState } from "@/state/BankProvider";
import { AccountList } from "./AccountList";
import { AccountPanel } from "./AccountPanel";
import { DeutscheBankLogo } from "./DeutscheBankLogo";
import { OpenAccountForm } from "./OpenAccountForm";

export function TellerConsole() {
  const state = useBankState();
  const selected = getSelectedAccount(state);

  return (
    <div className="console">
      <header className="console-header">
        <div className="console-title">
          <h1>Teller console</h1>
          <p className="muted">
            Session data only. Closing or refreshing the page clears all
            accounts.
          </p>
        </div>
        <DeutscheBankLogo />
      </header>
      <div className="console-body">
        <aside className="sidebar">
          <OpenAccountForm />
          <AccountList />
        </aside>
        <main className="workspace">
          {selected ? (
            <AccountPanel account={selected} />
          ) : (
            <div className="empty-workspace">
              <h2>No account selected</h2>
              <p className="muted">
                Open an account for the customer at the counter, then take
                deposits and withdrawals here.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
