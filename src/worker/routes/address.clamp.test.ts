import { describe, expect, it } from "vitest";
import { clampPage, clampPageSize } from "./address";

describe("clampPageSize", () => {
  it("defaults to 50 for missing/invalid/non-positive input", () => {
    expect(clampPageSize(null)).toBe(50);
    expect(clampPageSize("")).toBe(50);
    expect(clampPageSize("abc")).toBe(50);
    expect(clampPageSize("0")).toBe(50);
    expect(clampPageSize("-5")).toBe(50);
  });

  it("clamps to the non-negotiable 200 maximum", () => {
    expect(clampPageSize("300")).toBe(200);
    expect(clampPageSize("200")).toBe(200);
  });

  it("passes valid sizes through", () => {
    expect(clampPageSize("50")).toBe(50);
    expect(clampPageSize("75")).toBe(75);
  });
});

describe("clampPage", () => {
  it("defaults to 1 for missing/invalid/non-positive input", () => {
    expect(clampPage(null)).toBe(1);
    expect(clampPage("0")).toBe(1);
    expect(clampPage("-5")).toBe(1);
    expect(clampPage("abc")).toBe(1);
  });

  it("passes valid pages through", () => {
    expect(clampPage("7")).toBe(7);
  });
});
