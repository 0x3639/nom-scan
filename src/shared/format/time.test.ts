import { describe, expect, it } from "vitest";
import { formatAge, formatDate, formatTimestamp } from "./time";

const NOW_MS = 1_700_000_000_000; // fixed 2023-11-14, deterministic
const NOW_S = NOW_MS / 1000;

describe("formatAge", () => {
  it("returns 'just now' under 5s and clamps future timestamps", () => {
    expect(formatAge(NOW_S - 2, NOW_MS)).toBe("just now");
    expect(formatAge(NOW_S + 100, NOW_MS)).toBe("just now"); // Math.max(0,…) clamp
  });

  it("selects the correct unit", () => {
    expect(formatAge(NOW_S - 30, NOW_MS)).toBe("30s ago");
    expect(formatAge(NOW_S - 90, NOW_MS)).toBe("1m ago");
    expect(formatAge(NOW_S - 2 * 3600, NOW_MS)).toBe("2h ago");
    expect(formatAge(NOW_S - 24 * 3600, NOW_MS)).toBe("1d ago");
    expect(formatAge(NOW_S - 30 * 24 * 3600, NOW_MS)).toBe("1mo ago");
    expect(formatAge(NOW_S - 365 * 24 * 3600, NOW_MS)).toBe("1y ago");
  });

  it("returns an em dash for nullish input", () => {
    expect(formatAge(null, NOW_MS)).toBe("—");
    expect(formatAge(undefined, NOW_MS)).toBe("—");
  });
});

describe("formatTimestamp / formatDate", () => {
  it("returns an em dash for null", () => {
    expect(formatTimestamp(null)).toBe("—");
    expect(formatDate(null)).toBe("—");
  });

  // Locale-independent structural check — the year must appear regardless of TZ.
  it("renders the year", () => {
    expect(formatTimestamp(NOW_S)).toContain("2023");
    expect(formatDate(NOW_S)).toContain("2023");
  });
});
