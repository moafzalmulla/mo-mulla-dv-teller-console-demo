import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { cents } from "@/domain/money";
import type { BankStore } from "@/state/bankStore";
import { createTestStore, renderWithBank } from "@/test/renderWithBank";
import { TransferForm } from "./TransferForm";

describe("<TransferForm>", () => {
  let store: BankStore;

  beforeEach(() => {
    store = createTestStore();
    store.openAccount("Ada Lovelace");
    store.openAccount("Grace Hopper");
    store.openAccount("Alan Turing");
    store.deposit("ACC-0001", cents(10_000));
  });

  const balances = () => store.getState().accounts.map((a) => a.balance);
  const renderForm = () =>
    renderWithBank(<TransferForm account={store.getState().accounts[0]!} />, store);

  it("lists every other account in the dropdown", () => {
    renderForm();

    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual([
      "Choose an account",
      "Grace Hopper (ACC-0002)",
      "Alan Turing (ACC-0003)",
    ]);
  });

  it("transfers to the chosen account", async () => {
    const { user } = renderForm();

    await user.selectOptions(screen.getByLabelText("To account"), "ACC-0003");
    await user.type(screen.getByLabelText("Transfer amount"), "30");
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    expect(balances()).toEqual([7_000, 0, 3_000]);
    expect(screen.getByLabelText("Transfer amount")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Transferred £30.00 to Alan Turing (ACC-0003).",
    );
  });

  it("blocks a transfer larger than the balance", async () => {
    const { user } = renderForm();

    await user.selectOptions(screen.getByLabelText("To account"), "ACC-0002");
    await user.type(screen.getByLabelText("Transfer amount"), "100.01");
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Insufficient funds. The available balance is £100.00.",
    );
    expect(screen.getByLabelText("Transfer amount")).toHaveValue("100.01");
    expect(balances()).toEqual([10_000, 0, 0]);
  });

  it("requires a recipient", async () => {
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Transfer amount"), "10");
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose an account to transfer to.",
    );
    expect(balances()).toEqual([10_000, 0, 0]);
  });

  it("explains when there is no one to transfer to", () => {
    const solo = createTestStore();
    solo.openAccount("Ada Lovelace");
    renderWithBank(<TransferForm account={solo.getState().accounts[0]!} />, solo);

    expect(screen.getByText("Open another account to make a transfer.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transfer" })).not.toBeInTheDocument();
  });
});
