import { err, ok, type Result } from "./result";

/**
 * Money is represented as an integer number of cents. Floating point is never
 * used for arithmetic, which avoids the classic 0.1 + 0.2 rounding problems.
 *
 * The brand stops a plain `number` (e.g. a pounds value) being passed where
 * cents are expected; use `cents()` or `parseAmount()` to obtain one.
 */
export type Cents = number & { readonly __brand: "Cents" };

/** Largest single transaction the counter accepts: £1,000,000.00. */
export const MAX_TRANSACTION_CENTS = cents(100_000_000);

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Cents must be a safe integer, received ${value}`);
  }
  return value as Cents;
}

export const ZERO = cents(0);

export const addCents = (a: Cents, b: Cents): Cents => cents(a + b);

export const subtractCents = (a: Cents, b: Cents): Cents => cents(a - b);

export type AmountError =
  | { readonly code: "AMOUNT_REQUIRED" }
  | { readonly code: "AMOUNT_INVALID" }
  | { readonly code: "AMOUNT_TOO_PRECISE" }
  | { readonly code: "AMOUNT_NOT_POSITIVE" }
  | { readonly code: "AMOUNT_TOO_LARGE"; readonly max: Cents };

// Whole part: plain digits or comma-grouped thousands. Fraction: any digits,
// so we can distinguish "too many decimals" from "not a number".
const AMOUNT_PATTERN = /^£?(\d+|\d{1,3}(?:,\d{3})+)?(?:\.(\d*))?$/;

// Anything a teller could legitimately type in an amount; letters and other
// symbols are dropped as they are typed or pasted.
export const NOT_AMOUNT_CHARS = /[^\d.,£]/g;

/**
 * Parses teller input such as "25", "25.5", "£1,250.00" or ".75" into cents.
 * Parsing is done on the string digits, never via parseFloat.
 */
export function parseAmount(raw: string): Result<Cents, AmountError> {
  const input = raw.trim();
  if (input === "") return err({ code: "AMOUNT_REQUIRED" });

  const match = AMOUNT_PATTERN.exec(input);
  const whole = match?.[1];
  const fraction = match?.[2];
  if (!match || (whole === undefined && !fraction)) {
    return err({ code: "AMOUNT_INVALID" });
  }
  if (fraction !== undefined && fraction.length > 2) {
    return err({ code: "AMOUNT_TOO_PRECISE" });
  }

  const wholeDigits = (whole ?? "0").replaceAll(",", "");
  // Guard before converting so absurdly long input can't lose precision.
  if (wholeDigits.replace(/^0+/, "").length > 12) {
    return err({ code: "AMOUNT_TOO_LARGE", max: MAX_TRANSACTION_CENTS });
  }

  const value = cents(
    Number(wholeDigits) * 100 + Number((fraction ?? "").padEnd(2, "0")),
  );
  if (value <= 0) return err({ code: "AMOUNT_NOT_POSITIVE" });
  if (value > MAX_TRANSACTION_CENTS) {
    return err({ code: "AMOUNT_TOO_LARGE", max: MAX_TRANSACTION_CENTS });
  }
  return ok(value);
}

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export function formatCents(value: Cents): string {
  return gbp.format(value / 100);
}
