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
});
