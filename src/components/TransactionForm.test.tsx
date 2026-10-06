import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import type { BankStore } from "@/state/bankStore";
import { createTestStore, renderWithBank } from "@/test/renderWithBank";
import { TransactionForm } from "./TransactionForm";

describe("<TransactionForm>", () => {
  let store: BankStore;

  beforeEach(() => {
    store = createTestStore();
    store.openAccount("Ada Lovelace");
  });

  const balance = () => store.getState().accounts[0]?.balance;

  it("deposits by default", async () => {
    const { user } = renderWithBank(<TransactionForm account={store.getState().accounts[0]!} />, store);

    await user.type(screen.getByLabelText("Amount"), "125.50");
    await user.click(screen.getByRole("button", { name: "Deposit" }));

    expect(balance()).toBe(12_550);
    expect(screen.getByLabelText("Amount")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("Deposited £125.50.");
  });

  it("withdraws when Withdrawal is chosen", async () => {
    store.deposit("ACC-0001", cents(10_000));
    const { user } = renderWithBank(<TransactionForm account={store.getState().accounts[0]!} />, store);

    await user.click(screen.getByRole("radio", { name: "Withdrawal" }));
    await user.type(screen.getByLabelText("Amount"), "40");
    await user.click(screen.getByRole("button", { name: "Withdraw" }));

    expect(balance()).toBe(6_000);
    expect(screen.getByRole("status")).toHaveTextContent("Withdrew £40.00.");
  });

  it("blocks an overdraft with a validation error and keeps the amount", async () => {
    store.deposit("ACC-0001", cents(2_000));
    const { user } = renderWithBank(<TransactionForm account={store.getState().accounts[0]!} />, store);

    await user.click(screen.getByRole("radio", { name: "Withdrawal" }));
    await user.type(screen.getByLabelText("Amount"), "20.01");
    await user.click(screen.getByRole("button", { name: "Withdraw" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Insufficient funds. The available balance is £20.00.",
    );
    expect(screen.getByLabelText("Amount")).toHaveValue("20.01");
    expect(balance()).toBe(2_000);
  });

  it("ignores letters and other symbols in the amount", async () => {
    const { user } = renderWithBank(<TransactionForm account={store.getState().accounts[0]!} />, store);
    const input = screen.getByLabelText("Amount");

    await user.type(input, "1a2-b.5 0x");
    expect(input).toHaveValue("12.50");

    await user.clear(input);
    await user.click(input);
    await user.paste("GBP £1,250.00");
    expect(input).toHaveValue("£1,250.00");
  });

  it("shows the transfer form on the Transfer tab", async () => {
    store.openAccount("Grace Hopper");
    store.deposit("ACC-0001", cents(5_000));
    const { user } = renderWithBank(<TransactionForm account={store.getState().accounts[0]!} />, store);

    await user.click(screen.getByRole("radio", { name: "Transfer" }));
    await user.selectOptions(screen.getByLabelText("To account"), "ACC-0002");
    await user.type(screen.getByLabelText("Transfer amount"), "20");
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    expect(store.getState().accounts.map((a) => a.balance)).toEqual([3_000, 2_000]);
    expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
  });

  it.each([
    ["", "Enter an amount."],
    ["1.2.3", "Enter the amount as a number, for example 25.00."],
    ["0", "Enter an amount greater than £0.00."],
    ["1.234", "Amounts can't go below a penny. Use up to 2 decimal places."],
    ["2000000", "The counter limit is £1,000,000.00 per transaction."],
  ])("rejects %j", async (input, message) => {
    const { user } = renderWithBank(<TransactionForm account={store.getState().accounts[0]!} />, store);

    if (input) await user.type(screen.getByLabelText("Amount"), input);
    await user.click(screen.getByRole("button", { name: "Deposit" }));

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText("Amount")).toHaveAttribute("aria-invalid", "true");
    expect(balance()).toBe(0);
  });
});
