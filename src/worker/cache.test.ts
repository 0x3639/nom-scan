import { describe, expect, it, vi } from "vitest";
import { withCache } from "./cache";

function get(url: string): Request {
  return new Request(url, { method: "GET" });
}

describe("withCache", () => {
  it("bypasses the cache for non-GET requests", async () => {
    const producer = vi.fn(async () => new Response("post"));
    const res = await withCache(new Request("https://x/a", { method: "POST" }), 60, producer);
    expect(await res.text()).toBe("post");
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it("stores on miss and serves the cached copy on hit", async () => {
    const url = "https://x/hit-test";
    const producer = vi.fn(async () => new Response("v1"));
    expect(await (await withCache(get(url), 60, producer)).text()).toBe("v1");
    expect(await (await withCache(get(url), 60, producer)).text()).toBe("v1");
    expect(producer).toHaveBeenCalledTimes(1); // not re-run on hit
  });

  it("does not cache non-ok responses", async () => {
    const url = "https://x/error-test";
    const producer = vi.fn(async () => new Response("err", { status: 500 }));
    await withCache(get(url), 60, producer);
    await withCache(get(url), 60, producer);
    expect(producer).toHaveBeenCalledTimes(2); // re-run because the 500 wasn't cached
  });

  it("rewrites Cache-Control with the ttl on the cached copy", async () => {
    const url = "https://x/ttl-test";
    const producer = vi.fn(async () => new Response("ok"));
    await withCache(get(url), 42, producer);
    const hit = await withCache(get(url), 42, producer);
    expect(hit.headers.get("Cache-Control")).toContain("max-age=42");
  });

  it("keys on the canonical URL so junk-param variants share one entry", async () => {
    const canonical = "https://x/canon-test?page=1";
    const producer = vi.fn(async () => new Response("c1"));
    await withCache(get("https://x/canon-test?page=1&junk=a"), 60, producer, canonical);
    await withCache(get("https://x/canon-test?page=1&junk=b"), 60, producer, canonical);
    expect(producer).toHaveBeenCalledTimes(1); // second junk variant is a hit
  });

  it("evaluates a ttl thunk after the producer so routes can pick the TTL from the data", async () => {
    const url = "https://x/thunk-test";
    let ttl = 86400;
    const producer = vi.fn(async () => {
      ttl = 5; // producer downgrades the TTL based on what it fetched
      return new Response("ok");
    });
    await withCache(get(url), () => ttl, producer);
    const hit = await withCache(get(url), () => ttl, producer);
    expect(hit.headers.get("Cache-Control")).toContain("max-age=5");
  });
});
