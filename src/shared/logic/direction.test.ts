import { describe, expect, it } from "vitest";
import { getDirection } from "./direction";

const viewedAddress = "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp";

describe("getDirection", () => {
  it("classifies outgoing, incoming, self, and paired rows", () => {
    expect(getDirection({ hash: "out", address: viewedAddress, to_address: "z1other" }, viewedAddress)).toBe("OUT");
    expect(getDirection({ hash: "in", address: "z1other", to_address: viewedAddress }, viewedAddress)).toBe("IN");
    expect(getDirection({ hash: "self", address: viewedAddress, to_address: viewedAddress }, viewedAddress)).toBe("SELF");
    expect(getDirection({ hash: "pair", address: "z1other", to_address: null }, viewedAddress)).toBe("PAIR");
  });
});
