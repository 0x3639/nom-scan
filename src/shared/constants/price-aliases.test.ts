import { describe, expect, it } from "vitest";
import { priceFeedKey } from "./price-aliases";

describe("priceFeedKey", () => {
  it("returns null for missing symbols", () => {
    expect(priceFeedKey(null)).toBeNull();
    expect(priceFeedKey(undefined)).toBeNull();
    expect(priceFeedKey("")).toBeNull();
  });

  it("maps aliases case-insensitively to the feed key", () => {
    expect(priceFeedKey("WBTC")).toBe("btc");
    expect(priceFeedKey("wbtc")).toBe("btc");
    expect(priceFeedKey("weth")).toBe("eth");
  });

  it("lowercases non-aliased symbols", () => {
    expect(priceFeedKey("ZNN")).toBe("znn");
    expect(priceFeedKey("QSR")).toBe("qsr");
    expect(priceFeedKey("Znn")).toBe("znn");
  });
});
