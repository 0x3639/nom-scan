import { describe, expect, it } from "vitest";
import { detectQueryType, normalizeHash } from "./identifier";

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
