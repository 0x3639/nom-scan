import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";

// Keep the real unwrapCollection/clampPage — only the network call is mocked.
vi.mock("../upstream", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../upstream")>()),
  nomIndexerFetch: vi.fn(),
}));
import { nomIndexerFetch } from "../upstream";
// withCache should just run the producer in tests (no Cache API in node).
vi.mock("../cache", () => ({
  withCache: (_req: Request, _ttl: number | (() => number), fn: () => Promise<Response>) => fn(),
}));
import { getTransactions, clampAllowedPageSize, clampPage } from "./transactions";

const env = {} as Env;
const ctx = {} as ExecutionContext;

function req(qs: string): Request {
  return new Request(`https://x/api/transactions${qs}`);
}

describe("clampAllowedPageSize", () => {
  it("accepts the allowed sizes", () => {
    expect(clampAllowedPageSize("10")).toBe(10);
    expect(clampAllowedPageSize("25")).toBe(25);
    expect(clampAllowedPageSize("50")).toBe(50);
    expect(clampAllowedPageSize("100")).toBe(100);
  });
  it("falls back to 10 for disallowed or garbage values", () => {
    expect(clampAllowedPageSize("7")).toBe(10);
    expect(clampAllowedPageSize("33")).toBe(10);
    expect(clampAllowedPageSize("200")).toBe(10);
    expect(clampAllowedPageSize(null)).toBe(10);
    expect(clampAllowedPageSize("abc")).toBe(10);
  });
});

describe("clampPage", () => {
  it("defaults to 1 and rejects <1 / garbage", () => {
    expect(clampPage(null)).toBe(1);
    expect(clampPage("0")).toBe(1);
    expect(clampPage("-3")).toBe(1);
    expect(clampPage("abc")).toBe(1);
    expect(clampPage("4")).toBe(4);
  });
});

describe("getTransactions", () => {
  beforeEach(() => vi.mocked(nomIndexerFetch).mockReset());

  it("defaults to page=1, page_size=10, sort=desc and passes {data,pagination} through", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue({
      data: [{ hash: "a" }],
      pagination: { page: 1, page_size: 10, total: 1 },
    });
    const res = await getTransactions(req(""), env, ctx, {});
    expect(vi.mocked(nomIndexerFetch).mock.calls[0]?.[1]).toBe(
      "/api/v1/account_blocks?page=1&page_size=10&sort=desc",
    );
    const body = (await res.json()) as { ok: boolean; data: unknown; pagination: unknown };
    expect(body).toMatchObject({
      ok: true,
      data: [{ hash: "a" }],
      pagination: { total: 1 },
    });
  });

  it("forwards explicit page/sort and clamps a disallowed page_size to 10", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue({ data: [], pagination: { page: 2, page_size: 10 } });
    await getTransactions(req("?page=2&page_size=33&sort=asc"), env, ctx, {});
    expect(vi.mocked(nomIndexerFetch).mock.calls[0]?.[1]).toBe(
      "/api/v1/account_blocks?page=2&page_size=10&sort=asc",
    );
  });

  it("tolerates a bare-array upstream and synthesizes pagination", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue([{ hash: "b" }]);
    const res = await getTransactions(req("?page_size=25"), env, ctx, {});
    const body = (await res.json()) as { ok: boolean; data: unknown; pagination: unknown };
    expect(body).toMatchObject({
      ok: true,
      data: [{ hash: "b" }],
      pagination: { page: 1, page_size: 25 },
    });
  });
});
