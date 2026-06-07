import { describe, expect, it } from "vitest";
import { NomScanFetchError, isNotFoundError } from "./client";

describe("isNotFoundError", () => {
  it("is true for a NomScanFetchError with code not_found", () => {
    const err = new NomScanFetchError({ code: "not_found", message: "nope", status: 404 });
    expect(isNotFoundError(err)).toBe(true);
  });

  it("is false for other NomScanFetchError codes", () => {
    const err = new NomScanFetchError({ code: "internal", message: "boom", status: 500 });
    expect(isNotFoundError(err)).toBe(false);
  });

  it("is false for non-NomScanFetchError values", () => {
    expect(isNotFoundError(new Error("not_found"))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError({ code: "not_found" })).toBe(false);
  });
});
