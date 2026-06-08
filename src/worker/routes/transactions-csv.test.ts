import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { UpstreamError } from "../errors";

vi.mock("../upstream", () => ({ nomIndexerFetch: vi.fn() }));
import { nomIndexerFetch } from "../upstream";
vi.mock("../services/tokens", () => ({ getToken: vi.fn() }));
import { getToken } from "../services/tokens";

import { getAddressTransactionsCsv, csvCell } from "./transactions-csv";

const env = {} as Env;
const ctx = {} as ExecutionContext;
const ADDR = "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp";
const OTHER = "z1qzqajuhyfqkk4fy2z3ls0x29quyetkvqfd6n4x";

function req(address: string): Request {
  return new Request(`https://x/api/address/${address}/transactions.csv`);
}

// One upstream page of `n` rows; each row sends ADDR -> OTHER, 1.0 ZNN.
function page(n: number, startHeight = 0) {
  const data = Array.from({ length: n }, (_, i) => ({
    hash: `h${startHeight + i}`,
    block_type: 2,
    method: "",
    momentum_timestamp: 1700000000 + i,
    address: ADDR,
    to_address: OTHER,
    amount: "100000000",
    token_standard: "zts1znnxxxxxxxxxxxxx9z4ulx",
    momentum_height: startHeight + i,
    momentum_hash: `m${startHeight + i}`,
  }));
  return { data, pagination: { page: 1, page_size: 200 } };
}

const ZNN_META = {
  token_standard: "zts1znnxxxxxxxxxxxxx9z4ulx",
  name: "Zenon",
  symbol: "ZNN",
  decimals: 8,
};

describe("csvCell", () => {
  it("wraps every value in quotes and doubles internal quotes", () => {
    expect(csvCell("abc")).toBe('"abc"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(123)).toBe('"123"');
  });
  it("neutralizes leading formula characters", () => {
    expect(csvCell("=cmd")).toBe('"\'=cmd"');
    expect(csvCell("+1")).toBe('"\'+1"');
    expect(csvCell("-1")).toBe('"\'-1"');
    expect(csvCell("@x")).toBe('"\'@x"');
  });
  it("neutralizes a formula char hidden behind leading whitespace", () => {
    expect(csvCell(" =1+1")).toBe('"\' =1+1"');
    expect(csvCell("\t=cmd")).toBe('"\'\t=cmd"');
  });
});

describe("getAddressTransactionsCsv", () => {
  beforeEach(() => {
    vi.mocked(nomIndexerFetch).mockReset();
    vi.mocked(getToken).mockReset();
    vi.mocked(getToken).mockResolvedValue(ZNN_META);
  });

  it("400s on an invalid address", async () => {
    const res = await getAddressTransactionsCsv(req("not-an-address"), env, ctx, {
      address: "not-an-address",
    });
    expect(res.status).toBe(400);
  });

  it("aggregates pages, stops on a short page, and emits header + data rows", async () => {
    vi.mocked(nomIndexerFetch)
      .mockResolvedValueOnce(page(200, 0))
      .mockResolvedValueOnce(page(30, 200)); // short page -> stop
    const res = await getAddressTransactionsCsv(req(ADDR), env, ctx, { address: ADDR });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const text = await res.text();
    const lines = text.trim().split("\r\n");
    expect(lines).toHaveLength(1 + 230); // header + 230 rows
    expect(lines[0]).toBe(
      [
        "tx_hash", "direction", "block_type", "method", "timestamp_utc",
        "timestamp_unix", "from_address", "to_address", "amount", "token_symbol",
        "amount_raw", "token_standard", "momentum_height", "momentum_hash",
      ].map((h) => `"${h}"`).join(","),
    );
    // Only two upstream pages fetched (short page ended the loop).
    expect(vi.mocked(nomIndexerFetch)).toHaveBeenCalledTimes(2);
  });

  it("formats amount via token decimals, includes raw amount, and computes OUT direction", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValueOnce(page(1, 0));
    const res = await getAddressTransactionsCsv(req(ADDR), env, ctx, { address: ADDR });
    const row = (await res.text()).trim().split("\r\n")[1];
    // OUT (sender==ADDR), amount "1" (100000000 @ 8 decimals), symbol ZNN, raw passthrough.
    expect(row).toContain('"OUT"');
    expect(row).toContain('"1"');
    expect(row).toContain('"ZNN"');
    expect(row).toContain('"100000000"');
  });

  it("enforces the 50-page / 10,000-row cap", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue(page(200, 0)); // always full
    const res = await getAddressTransactionsCsv(req(ADDR), env, ctx, { address: ADDR });
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines).toHaveLength(1 + 10000);
    expect(vi.mocked(nomIndexerFetch)).toHaveBeenCalledTimes(50);
  });

  it("returns a JSON error (not CSV) when upstream fails", async () => {
    vi.mocked(nomIndexerFetch).mockRejectedValue(new UpstreamError(500, "boom", null, null));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await getAddressTransactionsCsv(req(ADDR), env, ctx, { address: ADDR });
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    spy.mockRestore();
  });
});
