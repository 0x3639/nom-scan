import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { UpstreamError } from "../errors";

vi.mock("../upstream", () => ({ nomIndexerFetch: vi.fn() }));
import { nomIndexerFetch } from "../upstream";
import { getSearch } from "./search";

const env = {} as Env;
const ctx = {} as ExecutionContext;
const ADDR = "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp";
const HASH = "a".repeat(64);

function req(q: string): Request {
  return new Request(`https://x/api/search?q=${encodeURIComponent(q)}`);
}

describe("getSearch dispatch", () => {
  beforeEach(() => {
    vi.mocked(nomIndexerFetch).mockReset();
  });

  it("returns 400 for an empty query", async () => {
    const res = await getSearch(req(""), env, ctx, {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("bad_request");
  });

  it("resolves an existing address", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue({});
    const res = await getSearch(req(ADDR), env, ctx, {});
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual({ kind: "address", target: ADDR });
  });

  it("returns not_found when the address 404s upstream", async () => {
    vi.mocked(nomIndexerFetch).mockRejectedValue(new UpstreamError(404, "nf", null, null));
    const res = await getSearch(req(ADDR), env, ctx, {});
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual({ kind: "not_found" });
  });

  it("resolves an existing hash to a normalized (0x-stripped, lowercased) tx target", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue({});
    const res = await getSearch(req(`0x${"A".repeat(64)}`), env, ctx, {});
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual({ kind: "tx", target: HASH });
  });

  it("propagates non-404 upstream errors instead of swallowing them as not_found", async () => {
    vi.mocked(nomIndexerFetch).mockRejectedValue(new UpstreamError(500, "boom", null, null));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await getSearch(req(ADDR), env, ctx, {});
    // Upstream 5xx surfaces to the client as a gateway error, not a mirrored 500.
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("upstream_error");
    spy.mockRestore();
  });

  it("does not call upstream for invalid input", async () => {
    const res = await getSearch(req("hello"), env, ctx, {});
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual({ kind: "not_found" });
    expect(nomIndexerFetch).not.toHaveBeenCalled();
  });

  it("resolves an existing momentum height", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue({});
    const res = await getSearch(req("13444825"), env, ctx, {});
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual({ kind: "momentum", target: "13444825" });
  });

  it("returns not_found when the momentum height 404s upstream", async () => {
    vi.mocked(nomIndexerFetch).mockRejectedValue(new UpstreamError(404, "nf", null, null));
    const res = await getSearch(req("999999999"), env, ctx, {});
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual({ kind: "not_found" });
  });
});
