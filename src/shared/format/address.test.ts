import { describe, expect, it } from "vitest";
import { truncateMiddle } from "./address";

describe("truncateMiddle", () => {
  it("returns an empty string unchanged", () => {
    expect(truncateMiddle("")).toBe("");
  });

  it("returns values at the head+tail+1 boundary unchanged", () => {
    expect(truncateMiddle("a".repeat(15))).toBe("a".repeat(15)); // 8 + 6 + 1
  });

  it("truncates one character past the boundary", () => {
    expect(truncateMiddle("a".repeat(16))).toBe(`${"a".repeat(8)}…${"a".repeat(6)}`);
  });

  it("truncates a real address to head 8 … tail 6", () => {
    expect(truncateMiddle("z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp")).toBe("z1qxemde…xsctrp");
  });

  it("honors custom head/tail lengths", () => {
    const hash = "0123456789abcdef".repeat(4); // 64 chars
    expect(truncateMiddle(hash, 10, 8)).toBe(`${hash.slice(0, 10)}…${hash.slice(-8)}`);
  });
});
