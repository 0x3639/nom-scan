import { describe, expect, it } from "vitest";
import { formatAmount, parseAmount } from "./amount";
import { formatUsd, rawToNumber } from "./money";

describe("formatAmount", () => {
  it("formats large raw integer strings without Number coercion", () => {
    expect(formatAmount("1234567890123456789", 8)).toBe("12,345,678,901.23456789");
  });

  it("handles negatives, zero decimals, and trimmed fractional zeroes", () => {
    expect(formatAmount("-123450000", 4)).toBe("-12,345");
    expect(formatAmount("1234567", 0)).toBe("1,234,567");
    expect(formatAmount("100000000", 8)).toBe("1");
  });

  it("returns invalid raw values unchanged", () => {
    expect(formatAmount("not-a-number", 8)).toBe("not-a-number");
  });
});

describe("parseAmount", () => {
  it("parses decimal input into raw integer strings", () => {
    expect(parseAmount("1.2345", 8)).toBe("123450000");
    expect(parseAmount("0.000000019", 8)).toBe("1");
  });
});

describe("money formatting", () => {
  it("converts raw amounts for display-only valuation math", () => {
    expect(rawToNumber("123456789", 8)).toBe(1.23456789);
    expect(rawToNumber("-100", 2)).toBe(-1);
  });

  it("formats edge-case USD values", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.001)).toBe("< $0.01");
    expect(formatUsd(-0.001)).toBe("> -$0.01");
    expect(formatUsd(Number.NaN)).toBe("\u2014");
  });
});
