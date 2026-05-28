import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseRetryAfter } from "./upstream";

describe("parseRetryAfter", () => {
  it("returns null for missing or unparseable headers", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
  });

  it("parses numeric seconds and clamps negatives to 0", () => {
    expect(parseRetryAfter("120")).toBe(120);
    expect(parseRetryAfter("0")).toBe(0);
    expect(parseRetryAfter("-5")).toBe(0);
  });

  describe("HTTP-date headers", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2023-11-14T00:00:00Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns positive seconds for a future date", () => {
      const future = new Date("2023-11-14T00:01:00Z").toUTCString();
      expect(parseRetryAfter(future)).toBe(60);
    });

    it("clamps a past date to 0", () => {
      const past = new Date("2023-11-13T23:00:00Z").toUTCString();
      expect(parseRetryAfter(past)).toBe(0);
    });
  });
});
