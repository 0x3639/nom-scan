import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import type { MomentumDetail } from "@shared/api/pfscan";

vi.mock("../upstream", () => ({ nomIndexerFetch: vi.fn() }));
import { nomIndexerFetch } from "../upstream";
import { UpstreamError } from "../errors";
import { getMomentum } from "./momentum";

const env = {} as Env;
const ctx = {} as ExecutionContext;

function req(): Request {
  return new Request("https://x/api/momentum/100");
}

const M = (height: number): MomentumDetail => ({
  height,
  hash: `hash${height}`,
  timestamp: 1700000000 + height,
  tx_count: 3,
  producer: "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp",
});

beforeEach(() => {
  vi.mocked(nomIndexerFetch).mockReset();
});

describe("getMomentum", () => {
  it("returns 400 for a non-numeric or missing height", async () => {
    expect((await getMomentum(req(), env, ctx, {})).status).toBe(400);
    expect((await getMomentum(req(), env, ctx, { height: "abc" })).status).toBe(400);
    expect((await getMomentum(req(), env, ctx, { height: "0" })).status).toBe(400);
  });

  it("returns the momentum and derives previous_hash from height-1", async () => {
    vi.mocked(nomIndexerFetch).mockImplementation(async (_e, path: string) =>
      path.endsWith("/100") ? M(100) : M(99),
    );
    const res = await getMomentum(req(), env, ctx, { height: "100" });
    const body = (await res.json()) as { data: MomentumDetail };
    expect(body.data.height).toBe(100);
    expect(body.data.previous_hash).toBe("hash99");
  });

  it("strips commas from the height before building the upstream path", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue(M(12708298));
    const res = await getMomentum(req(), env, ctx, { height: "12,708,298" });
    expect(res.status).toBe(200);
    expect(nomIndexerFetch).toHaveBeenCalledWith(env, "/api/v1/momentums/12708298");
    expect(nomIndexerFetch).toHaveBeenCalledWith(env, "/api/v1/momentums/12708297");
  });

  it("omits previous_hash at height 1 without fetching a previous momentum", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue(M(1));
    const res = await getMomentum(req(), env, ctx, { height: "1" });
    const body = (await res.json()) as { data: MomentumDetail };
    expect(body.data.previous_hash).toBeUndefined();
    expect(nomIndexerFetch).toHaveBeenCalledTimes(1);
  });

  it("still returns the momentum if the previous-momentum fetch fails", async () => {
    vi.mocked(nomIndexerFetch).mockImplementation(async (_e, path: string) => {
      if (path.endsWith("/100")) return M(100);
      throw new UpstreamError(404, "nf", null, null);
    });
    const res = await getMomentum(req(), env, ctx, { height: "100" });
    const body = (await res.json()) as { data: MomentumDetail };
    expect(res.status).toBe(200);
    expect(body.data.previous_hash).toBeUndefined();
  });

  it("passes through a 404 when the requested height does not exist", async () => {
    vi.mocked(nomIndexerFetch).mockRejectedValue(new UpstreamError(404, "nf", null, null));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await getMomentum(req(), env, ctx, { height: "999999999" });
    expect(res.status).toBe(404);
    spy.mockRestore();
  });
});
