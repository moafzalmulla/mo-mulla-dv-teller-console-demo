import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithBank } from "@/test/renderWithBank";
import { TellerConsole } from "./TellerConsole";

/**
 * End-to-end style tests through the full component tree, driven only via
 * what a teller can see and do.
 */
describe("<TellerConsole>", () => {
  const balance = () => screen.getByRole("status", { name: "Balance" });

  async function openAccount(
    user: ReturnType<typeof renderWithBank>["user"],
    name: string,
  ) {
    await user.type(screen.getByLabelText("Customer name"), name);
    await user.click(screen.getByRole("button", { name: "Open account" }));
  }

  async function transact(
    user: ReturnType<typeof renderWithBank>["user"],
    type: "Deposit" | "Withdrawal",
    amount: string,
  ) {
    await user.click(screen.getByRole("radio", { name: type }));
    await user.type(screen.getByLabelText("Amount"), amount);
    await user.click(
      screen.getByRole("button", { name: type === "Deposit" ? "Deposit" : "Withdraw" }),
    );
  }

  it("starts with an empty state that prompts to open an account", () => {
    renderWithBank(<TellerConsole />);
    expect(
      screen.getByRole("heading", { name: "No account selected" }),
    ).toBeInTheDocument();
  });

  it("opens an account at £0.00 with an empty history", async () => {
    const { user } = renderWithBank(<TellerConsole />);
    await openAccount(user, "Ada Lovelace");

    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByText("Account ACC-0001")).toBeInTheDocument();
    expect(balance()).toHaveTextContent("£0.00");
    expect(screen.getByText(/No transactions yet/)).toBeInTheDocument();
  });

  it("updates the balance and ledger after deposits and withdrawals", async () => {
    const { user } = renderWithBank(<TellerConsole />);
    await openAccount(user, "Ada Lovelace");

    await transact(user, "Deposit", "100");
    await transact(user, "Withdrawal", "30.25");

    expect(balance()).toHaveTextContent("£69.75");

    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    // Newest first.
    expect(rows.map((row) => within(row).getAllByRole("cell").slice(1).map((c) => c.textContent))).toEqual([
      ["Withdrawal", "−£30.25", "£69.75"],
      ["Deposit", "+£100.00", "£100.00"],
    ]);
  });

  it("prevents overdraft and leaves the balance untouched", async () => {
    const { user } = renderWithBank(<TellerConsole />);
    await openAccount(user, "Ada Lovelace");
    await transact(user, "Deposit", "10");

    await transact(user, "Withdrawal", "10.01");

    expect(screen.getByRole("alert")).toHaveTextContent("Insufficient funds");
    expect(balance()).toHaveTextContent("£10.00");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  });

  it("switches between accounts, each with its own balance and history", async () => {
    const { user } = renderWithBank(<TellerConsole />);
    await openAccount(user, "Ada Lovelace");
    await transact(user, "Deposit", "50");
    await openAccount(user, "Grace Hopper");

    // The newly opened account becomes the active one.
    expect(screen.getByRole("heading", { name: "Grace Hopper" })).toBeInTheDocument();
    expect(balance()).toHaveTextContent("£0.00");

    const accounts = screen.getByRole("navigation", { name: /Accounts/ });
    await user.click(within(accounts).getByRole("button", { name: /Ada Lovelace/ }));

    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(balance()).toHaveTextContent("£50.00");
    expect(
      within(accounts).getByRole("button", { name: /Ada Lovelace/ }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("resets a half-entered amount when switching customer", async () => {
    const { user } = renderWithBank(<TellerConsole />);
    await openAccount(user, "Ada Lovelace");
    await openAccount(user, "Grace Hopper");

    await user.type(screen.getByLabelText("Amount"), "999");
    const accounts = screen.getByRole("navigation", { name: /Accounts/ });
    await user.click(within(accounts).getByRole("button", { name: /Ada Lovelace/ }));

    expect(screen.getByLabelText("Amount")).toHaveValue("");
  });
});
