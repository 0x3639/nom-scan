import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./env";
import { nomIndexerFetch, parseRetryAfter, unwrapCollection } from "./upstream";
import { UpstreamError } from "./errors";

describe("parseRetryAfter", () => {
  it("returns null for missing or unparseable headers", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
  });

  it("parses numeric seconds and clamps negatives to 0", () => {
    expect(parseRetryAfter("120")).toBe(120);
    expect(parseRetryAfter("0")).toBe(0);
    expect(parseRetryAfter("-5")).toBe(0);
  });

  describe("HTTP-date headers", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2023-11-14T00:00:00Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns positive seconds for a future date", () => {
      const future = new Date("2023-11-14T00:01:00Z").toUTCString();
      expect(parseRetryAfter(future)).toBe(60);
    });

    it("clamps a past date to 0", () => {
      const past = new Date("2023-11-13T23:00:00Z").toUTCString();
      expect(parseRetryAfter(past)).toBe(0);
    });
  });
});

describe("unwrapCollection", () => {
  it("unwraps {data, pagination}, tolerates bare arrays, and defaults empty", () => {
    expect(unwrapCollection({ data: [1], pagination: { page: 2, page_size: 50 } })).toEqual({
      entries: [1],
      pagination: { page: 2, page_size: 50 },
    });
    expect(unwrapCollection([1, 2])).toEqual({ entries: [1, 2] });
    expect(unwrapCollection(null)).toEqual({ entries: [] });
  });
});

describe("nomIndexerFetch body handling", () => {
  // Pre-minted JWT path avoids crypto.subtle in the node test env.
  const env = { NOM_INDEXER_JWT: "tok", NOM_INDEXER_BASE_URL: "https://upstream.test" } as Env;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a JSON 2xx body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"a":1}', { headers: { "content-type": "application/json" } })),
    );
    await expect(nomIndexerFetch(env, "/api/v1/status")).resolves.toEqual({ a: 1 });
  });

  it("throws UpstreamError 502 on a 2xx non-JSON body instead of returning the raw string", async () => {
    // e.g. an HTML maintenance page from a proxy in front of the indexer.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>down</html>", { headers: { "content-type": "text/html" } })),
    );
    const thrown = await nomIndexerFetch(env, "/api/v1/status").then(
      () => null,
      (e: unknown) => e,
    );
    expect(thrown).toBeInstanceOf(UpstreamError);
    expect((thrown as UpstreamError).status).toBe(502);
  });

  it("throws UpstreamError with the upstream status on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"detail":"nf"}', { status: 404 })),
    );
    const thrown = await nomIndexerFetch(env, "/api/v1/x").then(
      () => null,
      (e: unknown) => e,
    );
    expect(thrown).toBeInstanceOf(UpstreamError);
    expect((thrown as UpstreamError).status).toBe(404);
  });
});
