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

  it("classifies the viewer's own receive blocks as PAIR, never OUT", () => {
    // On a receive account-block, `address` is the block OWNER (the receiver) —
    // funds arrived via the paired send. Without the receive check these rows
    // hit the sender===me branch and mislabel received funds as OUT.
    // Live indexer shape: block_type 5 (contract receive) with the ZERO address
    // as a placeholder to_address.
    expect(
      getDirection(
        {
          hash: "recv5",
          block_type: 5,
          address: viewedAddress,
          to_address: "z1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsggv2f",
          paired_account_block: "e3ea",
        },
        viewedAddress,
      ),
    ).toBe("PAIR");
    // User receive (block_type 3) with an empty to_address.
    expect(
      getDirection(
        { hash: "recv3", block_type: 3, address: viewedAddress, to_address: null, paired_account_block: "0xabc" },
        viewedAddress,
      ),
    ).toBe("PAIR");
    // No block_type at all — falls back to the paired + no-real-recipient heuristic.
    expect(
      getDirection(
        { hash: "recv?", address: viewedAddress, to_address: null, paired_account_block: "0xabc" },
        viewedAddress,
      ),
    ).toBe("PAIR");
  });

  it("does not let the receive heuristic swallow real sends", () => {
    // A user send (block_type 2) with a paired receive reference stays OUT/IN.
    expect(
      getDirection(
        { hash: "send2", block_type: 2, address: viewedAddress, to_address: "z1other", paired_account_block: "p" },
        viewedAddress,
      ),
    ).toBe("OUT");
    expect(
      getDirection(
        { hash: "send2in", block_type: 2, address: "z1other", to_address: viewedAddress, paired_account_block: "p" },
        viewedAddress,
      ),
    ).toBe("IN");
  });
});
