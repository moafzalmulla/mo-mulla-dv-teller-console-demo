import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithBank } from "@/test/renderWithBank";
import { OpenAccountForm } from "./OpenAccountForm";

describe("<OpenAccountForm>", () => {
  it("opens an account and clears the field", async () => {
    const { user, store } = renderWithBank(<OpenAccountForm />);

    await user.type(screen.getByLabelText("Customer name"), "Ada Lovelace");
    await user.click(screen.getByRole("button", { name: "Open account" }));

    expect(store.getState().accounts).toHaveLength(1);
    expect(screen.getByLabelText("Customer name")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Opened ACC-0001 for Ada Lovelace.",
    );
  });

  it("submits with the Enter key", async () => {
    const { user, store } = renderWithBank(<OpenAccountForm />);
    await user.type(screen.getByLabelText("Customer name"), "Grace{Enter}");
    expect(store.getState().accounts[0]?.customerName).toBe("Grace");
  });

  it("shows an accessible error when the name is blank", async () => {
    const { user, store } = renderWithBank(<OpenAccountForm />);

    await user.click(screen.getByRole("button", { name: "Open account" }));

    const input = screen.getByLabelText("Customer name");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the customer's name.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter the customer's name.");
    expect(store.getState().accounts).toHaveLength(0);
  });

  it("clears the error once the teller starts typing", async () => {
    const { user } = renderWithBank(<OpenAccountForm />);
    await user.click(screen.getByRole("button", { name: "Open account" }));
    await user.type(screen.getByLabelText("Customer name"), "A");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
