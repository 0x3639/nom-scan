import { describe, expect, it } from "vitest";
import {
  detectQueryType,
  isAddress,
  isHash,
  isTokenStandard,
  normalizeAddress,
  normalizeHash,
  normalizeMomentum,
} from "./identifier";

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
  it("preserves mixed address case (invalid in Bech32) and trims", () => {
    expect(normalizeAddress("  z1AbC  ")).toBe("z1AbC");
  });

  it("folds the BIP-173 all-uppercase form (QR codes) to canonical lowercase", () => {
    expect(normalizeAddress(VALID_ADDR.toUpperCase())).toBe(VALID_ADDR);
    expect(isAddress(VALID_ADDR.toUpperCase())).toBe(true);
  });

  it("strips 0x / 0X and lowercases hashes", () => {
    expect(normalizeHash(`0X${"A".repeat(64)}`)).toBe("a".repeat(64));
    expect(normalizeHash("AbCd")).toBe("abcd");
  });

  it("strips momentum commas only at correct 3-digit group positions", () => {
    expect(normalizeMomentum("12,708,298")).toBe("12708298");
    // Malformed grouping must NOT silently collapse into a different height.
    expect(normalizeMomentum("1,2")).toBe("1,2");
    expect(detectQueryType("1,2")).toBe("invalid");
    expect(detectQueryType("12,,34")).toBe("invalid");
  });
});

describe("isTokenStandard", () => {
  it("accepts real ZTS standards", () => {
    expect(isTokenStandard("zts1znnxxxxxxxxxxxxx9z4ulx")).toBe(true);
    expect(isTokenStandard("zts1qsrxxxxxxxxxxxxxmrhjll")).toBe(true);
  });

  it("rejects wrong length, wrong prefix, and junk", () => {
    expect(isTokenStandard("zts1znnxxxxxxxxxxxxx9z4ul")).toBe(false); // 21-char body
    expect(isTokenStandard("zts1znnxxxxxxxxxxxxx9z4ulxx")).toBe(false); // 23-char body
    expect(isTokenStandard("z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp")).toBe(false);
    expect(isTokenStandard("ZTS1ZNNXXXXXXXXXXXXX9Z4ULX")).toBe(false);
    expect(isTokenStandard("../etc/passwd")).toBe(false);
    expect(isTokenStandard("")).toBe(false);
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
