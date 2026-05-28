import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import type { BalanceEntry, TxRow } from "@shared/api/pfscan";

vi.mock("../upstream", () => ({ nomIndexerFetch: vi.fn() }));
vi.mock("../services/tokens", () => ({ getToken: vi.fn() }));
import { nomIndexerFetch } from "../upstream";
import { getToken } from "../services/tokens";
import { getAddressBalances, getAddressTransactions } from "./address";

const env = {} as Env;
const ctx = {} as ExecutionContext;

beforeEach(() => {
  vi.mocked(nomIndexerFetch).mockReset();
  vi.mocked(getToken).mockReset();
  vi.mocked(getToken).mockResolvedValue(null);
});

describe("getAddressBalances", () => {
  const request = new Request("https://x/api/address/z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp/balances");

  it("returns 400 when the address param is missing", async () => {
    const res = await getAddressBalances(request, env, ctx, {});
    expect(res.status).toBe(400);
  });

  it("preserves a precision-critical 21-digit amount string untouched", async () => {
    const big = "123456789012345678901";
    vi.mocked(nomIndexerFetch).mockResolvedValue([{ token_standard: "zts1abc", balance: big }]);
    const res = await getAddressBalances(request, env, ctx, { address: "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp" });
    const body = (await res.json()) as { data: BalanceEntry[] };
    expect(body.data[0]!.balance).toBe(big);
  });

  it("accepts the {data} collection shape as well as a bare array", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue({ data: [{ token_standard: "zts1x", balance: "1" }] });
    const res = await getAddressBalances(request, env, ctx, { address: "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp" });
    const body = (await res.json()) as { data: BalanceEntry[] };
    expect(body.data).toHaveLength(1);
  });

  it("isolates a getToken failure for one entry without failing the response", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue([{ token_standard: "zts1x", balance: "1" }]);
    vi.mocked(getToken).mockRejectedValue(new Error("token fetch failed"));
    const res = await getAddressBalances(request, env, ctx, { address: "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: BalanceEntry[] };
    expect(body.data[0]!.token_standard).toBe("zts1x");
  });
});

describe("getAddressTransactions", () => {
  function txReq(query: string): Request {
    return new Request(`https://x/api/address/z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp/transactions${query}`, { method: "GET" });
  }

  it("passes through {data,pagination} from upstream", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue({
      data: [{ hash: "h1", address: "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp" }],
      pagination: { page: 1, page_size: 50, total: 1 },
    });
    const res = await getAddressTransactions(txReq("?page=1&sort=desc&k=a"), env, ctx, { address: "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp" });
    const body = (await res.json()) as { data: TxRow[]; pagination: { total?: number } };
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it("synthesizes pagination for a bare array and preserves a big amount string", async () => {
    const big = "987654321098765432109";
    vi.mocked(nomIndexerFetch).mockResolvedValue([{ hash: "h2", address: "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp", amount: big }]);
    const res = await getAddressTransactions(txReq("?page=1&sort=desc&k=b"), env, ctx, { address: "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp" });
    const body = (await res.json()) as { data: TxRow[]; pagination: { page: number; page_size: number } };
    expect(body.pagination).toEqual({ page: 1, page_size: 50 });
    expect(body.data[0]!.amount).toBe(big);
  });

  it("returns 400 for a missing address before touching the cache", async () => {
    const res = await getAddressTransactions(txReq("?k=c"), env, ctx, {});
    expect(res.status).toBe(400);
  });
});
