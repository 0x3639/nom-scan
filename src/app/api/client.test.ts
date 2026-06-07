import { describe, expect, it } from "vitest";
import { PFScanFetchError, isNotFoundError } from "./client";

describe("isNotFoundError", () => {
  it("is true for a PFScanFetchError with code not_found", () => {
    const err = new PFScanFetchError({ code: "not_found", message: "nope", status: 404 });
    expect(isNotFoundError(err)).toBe(true);
  });

  it("is false for other PFScanFetchError codes", () => {
    const err = new PFScanFetchError({ code: "internal", message: "boom", status: 500 });
    expect(isNotFoundError(err)).toBe(false);
  });

  it("is false for non-PFScanFetchError values", () => {
    expect(isNotFoundError(new Error("not_found"))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
    expect(isNotFoundError({ code: "not_found" })).toBe(false);
  });
});
