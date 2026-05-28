import { describe, expect, it } from "vitest";
import { detectQueryType, isAddress, isHash, normalizeAddress, normalizeHash } from "./identifier";

const VALID_ADDR = "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp"; // 40 chars (z1 + 38 body)

describe("isAddress length pinning", () => {
  it("accepts an exact 40-char address", () => {
    expect(isAddress(VALID_ADDR)).toBe(true);
  });

  it("rejects wrong-length and over-length strings", () => {
    expect(isAddress(VALID_ADDR.slice(0, -1))).toBe(false); // 39 chars
    expect(isAddress(`${VALID_ADDR}x`)).toBe(false); // 41 chars
  });

  it("rejects excluded Bech32 characters (1, b, i, o)", () => {
    expect(isAddress(`z1b${VALID_ADDR.slice(3)}`)).toBe(false);
  });
});

describe("isHash boundaries", () => {
  it("accepts exactly 64 hex chars, lower or upper case", () => {
    expect(isHash("a".repeat(64))).toBe(true);
    expect(isHash("A".repeat(64))).toBe(true);
    expect(isHash(`0x${"a".repeat(64)}`)).toBe(true);
  });

  it("rejects 63 / 65 chars and non-hex", () => {
    expect(isHash("a".repeat(63))).toBe(false);
    expect(isHash("a".repeat(65))).toBe(false);
    expect(isHash("g".repeat(64))).toBe(false);
  });
});

describe("normalization", () => {
  it("preserves address case (Bech32 is case-sensitive) and trims", () => {
    expect(normalizeAddress("  z1AbC  ")).toBe("z1AbC");
  });

  it("strips 0x / 0X and lowercases hashes", () => {
    expect(normalizeHash(`0X${"A".repeat(64)}`)).toBe("a".repeat(64));
    expect(normalizeHash("AbCd")).toBe("abcd");
  });
});

describe("detectQueryType mutual exclusivity", () => {
  // ADDRESS_RE requires a z1 prefix; HEX64_RE requires pure hex — so no input
  // can satisfy both, making the "ambiguous" branch effectively unreachable.
  it("classifies the canonical examples unambiguously", () => {
    expect(detectQueryType(VALID_ADDR)).toBe("address");
    expect(detectQueryType("a".repeat(64))).toBe("hash");
    expect(detectQueryType("   ")).toBe("invalid");
  });
});
