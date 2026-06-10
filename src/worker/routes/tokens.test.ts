import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";

vi.mock("../services/tokens", () => ({ getToken: vi.fn() }));
import { getToken } from "../services/tokens";
// withCache should just run the producer in tests — edge caching is covered by cache.test.ts.
vi.mock("../cache", () => ({
  withCache: (_req: Request, _ttl: number | (() => number), fn: () => Promise<Response>) => fn(),
}));
import { getTokenMeta } from "./tokens";

const env = {} as Env;
const ctx = {} as ExecutionContext;
const ZNN = "zts1znnxxxxxxxxxxxxx9z4ulx";

function req(standard: string): Request {
  return new Request(`https://x/api/tokens/${standard}`);
}

describe("getTokenMeta", () => {
  beforeEach(() => vi.mocked(getToken).mockReset());

  it("400s on junk token standards without touching upstream or the cache", async () => {
    for (const bad of ["", "abc", "zts1short", "../etc/passwd", "a".repeat(500)]) {
      const res = await getTokenMeta(req(bad), env, ctx, { standard: bad });
      expect(res.status).toBe(400);
    }
    expect(getToken).not.toHaveBeenCalled();
  });

  it("returns the token for a valid standard", async () => {
    vi.mocked(getToken).mockResolvedValue({ token_standard: ZNN, name: "Zenon", symbol: "ZNN", decimals: 8 });
    const res = await getTokenMeta(req(ZNN), env, ctx, { standard: ZNN });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { symbol: string } };
    expect(body.data.symbol).toBe("ZNN");
  });

  it("404s when the token does not exist", async () => {
    vi.mocked(getToken).mockResolvedValue(null);
    const res = await getTokenMeta(req(ZNN), env, ctx, { standard: ZNN });
    expect(res.status).toBe(404);
  });
});
