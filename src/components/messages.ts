import type { BankError } from "@/domain/bank";
import { formatCents, type AmountError } from "@/domain/money";

/**
 * Maps domain error codes to teller-facing copy. Keeping copy out of the
 * domain layer means wording (or translation) can change without touching
 * business rules, and tests can assert on codes rather than strings.
 */
export function describeError(error: BankError | AmountError): string {
  switch (error.code) {
    case "AMOUNT_REQUIRED":
      return "Enter an amount.";
    case "AMOUNT_INVALID":
      return "Enter the amount as a number, for example 25.00.";
    case "AMOUNT_TOO_PRECISE":
      return "Amounts can't go below a penny. Use up to 2 decimal places.";
    case "AMOUNT_NOT_POSITIVE":
    case "NON_POSITIVE_AMOUNT":
      return "Enter an amount greater than £0.00.";
    case "AMOUNT_TOO_LARGE":
      return `The counter limit is ${formatCents(error.max)} per transaction.`;
    case "CUSTOMER_NAME_REQUIRED":
      return "Enter the customer's name.";
    case "CUSTOMER_NAME_TOO_LONG":
      return `Customer names can be up to ${error.maxLength} characters.`;
    case "DUPLICATE_ACCOUNT_ID":
      return `Account ${error.accountId} already exists. Try again.`;
    case "ACCOUNT_NOT_FOUND":
      return `Account ${error.accountId} doesn't exist.`;
    case "SAME_ACCOUNT_TRANSFER":
      return "Choose a different account to transfer to.";
    case "INSUFFICIENT_FUNDS":
      return `Insufficient funds. The available balance is ${formatCents(error.available)}.`;
  }
}
