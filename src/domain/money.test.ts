// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  addCents,
  cents,
  formatCents,
  MAX_TRANSACTION_CENTS,
  parseAmount,
  subtractCents,
} from "./money";

describe("parseAmount", () => {
  it.each([
    ["25", 2500],
    ["25.5", 2550],
    ["25.50", 2550],
    ["0.01", 1],
    [".75", 75],
    ["10.", 1000],
    ["£1,250.99", 125099],
    ["  42  ", 4200],
    ["1000000", 100_000_000],
  ])("parses %j as %i cents", (input, expected) => {
    expect(parseAmount(input)).toEqual({ ok: true, value: expected });
  });

  it("avoids floating point errors (0.29 * 100 = 28.999…)", () => {
    expect(parseAmount("0.29")).toEqual({ ok: true, value: 29 });
    expect(parseAmount("1.15")).toEqual({ ok: true, value: 115 });
  });

  it.each(["", "   "])("requires a value (%j)", (input) => {
    expect(parseAmount(input)).toEqual({
      ok: false,
      error: { code: "AMOUNT_REQUIRED" },
    });
  });

  it.each(["abc", "-5", "1e3", "12,34", "1.2.3", ".", "£", "5 00", "Infinity"])(
    "rejects malformed input %j",
    (input) => {
      expect(parseAmount(input)).toEqual({
        ok: false,
        error: { code: "AMOUNT_INVALID" },
      });
    },
  );

  it("rejects sub-cent precision", () => {
    expect(parseAmount("1.005")).toEqual({
      ok: false,
      error: { code: "AMOUNT_TOO_PRECISE" },
    });
  });

  it.each(["0", "0.00", "£0"])("rejects zero (%j)", (input) => {
    expect(parseAmount(input)).toEqual({
      ok: false,
      error: { code: "AMOUNT_NOT_POSITIVE" },
    });
  });

  it.each(["1000000.01", "99999999999999999999"])(
    "rejects amounts above the counter limit (%j)",
    (input) => {
      expect(parseAmount(input)).toEqual({
        ok: false,
        error: { code: "AMOUNT_TOO_LARGE", max: MAX_TRANSACTION_CENTS },
      });
    },
  );
});

describe("cents", () => {
  it("rejects non-integers so dollars can't sneak in as cents", () => {
    expect(() => cents(1.5)).toThrow(RangeError);
    expect(() => cents(Number.NaN)).toThrow(RangeError);
  });

  it("adds and subtracts exactly", () => {
    expect(addCents(cents(10), cents(20))).toBe(30);
    expect(subtractCents(cents(30), cents(10))).toBe(20);
  });
});

describe("formatCents", () => {
  it("formats as US dollars", () => {
    expect(formatCents(cents(0))).toBe("£0.00");
    expect(formatCents(cents(5))).toBe("£0.05");
    expect(formatCents(cents(123456789))).toBe("£1,234,567.89");
  });
});
