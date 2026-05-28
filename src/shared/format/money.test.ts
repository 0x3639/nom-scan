import { describe, expect, it } from "vitest";
import { formatUsd, rawToNumber } from "./money";

// Complements amount.test.ts (which covers the happy path) with the untested
// branches: empty/invalid input, zero decimals, sub-unit padding, and guards.
describe("rawToNumber edge branches", () => {
  it("returns 0 for empty/nullish input", () => {
    expect(rawToNumber("", 8)).toBe(0);
    expect(rawToNumber(null, 8)).toBe(0);
    expect(rawToNumber(undefined, 8)).toBe(0);
  });

  it("handles zero decimals", () => {
    expect(rawToNumber("1234", 0)).toBe(1234);
  });

  it("pads sub-unit amounts", () => {
    expect(rawToNumber("5", 8)).toBe(0.00000005);
  });

  it("returns 0 for non-integer raw strings", () => {
    expect(rawToNumber("1.5", 8)).toBe(0);
    expect(rawToNumber("abc", 8)).toBe(0);
  });

  it("handles large negative values", () => {
    expect(rawToNumber("-123456789", 8)).toBe(-1.23456789);
  });
});

describe("formatUsd guards", () => {
  it("returns an em dash for nullish / non-finite values", () => {
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(undefined)).toBe("—");
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("formats a grouped currency value (locale-independent digit check)", () => {
    expect(formatUsd(1234.5).replace(/[^\d]/g, "")).toBe("123450");
  });
});
