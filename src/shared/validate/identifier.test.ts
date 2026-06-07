import { describe, expect, it } from "vitest";
import { detectQueryType, normalizeHash } from "./identifier";
import { isMomentumHeight, normalizeMomentum } from "./identifier";

describe("identifier detection", () => {
  it("detects Zenon-looking addresses", () => {
    expect(detectQueryType("z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp")).toBe("address");
  });

  it("detects and normalizes 64-character hashes with optional 0x prefix", () => {
    const hash = "A".repeat(64);
    expect(detectQueryType(`0x${hash}`)).toBe("hash");
    expect(normalizeHash(`0x${hash}`)).toBe("a".repeat(64));
  });

  it("rejects empty and malformed input", () => {
    expect(detectQueryType("")).toBe("invalid");
    expect(detectQueryType("hello")).toBe("invalid");
  });
});

describe("momentum height detection", () => {
  it("classifies a bare positive integer as momentum", () => {
    expect(detectQueryType("13444825")).toBe("momentum");
    expect(detectQueryType("  42 ")).toBe("momentum");
  });

  it("does not treat 0, negatives, or non-digits as momentum", () => {
    expect(detectQueryType("0")).toBe("invalid");
    expect(detectQueryType("-5")).toBe("invalid");
    expect(detectQueryType("1.5")).toBe("invalid");
    expect(detectQueryType("12x")).toBe("invalid");
  });

  it("does not misclassify addresses or 64-hex hashes as momentum", () => {
    expect(detectQueryType("z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp")).toBe("address");
    expect(detectQueryType("a".repeat(64))).toBe("hash");
  });

  it("caps digit length at 15 so heights stay within Number.MAX_SAFE_INTEGER", () => {
    expect(isMomentumHeight("1".repeat(16))).toBe(false);
    expect(isMomentumHeight("1".repeat(15))).toBe(true);
    // The largest accepted value must round-trip through Number() exactly.
    expect(Number("9".repeat(15)) < Number.MAX_SAFE_INTEGER).toBe(true);
  });

  it("normalizeMomentum trims to the canonical digit string", () => {
    expect(normalizeMomentum("  77 ")).toBe("77");
  });
});
