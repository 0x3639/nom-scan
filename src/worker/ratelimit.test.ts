import { describe, expect, it, vi } from "vitest";
import type { Env } from "./env";
import { enforceClientRateLimit } from "./ratelimit";

function req(ip?: string): Request {
  return new Request("https://x/api/status", {
    headers: ip ? { "CF-Connecting-IP": ip } : {},
  });
}

function envWith(limit: (opts: { key: string }) => Promise<{ success: boolean }>): Env {
  return { API_LIMITER: { limit } } as unknown as Env;
}

describe("enforceClientRateLimit", () => {
  it("fails open when the binding is absent", async () => {
    expect(await enforceClientRateLimit(req("1.2.3.4"), {} as Env)).toBeNull();
  });

  it("passes through under the limit, keyed by CF-Connecting-IP", async () => {
    const limit = vi.fn(async () => ({ success: true }));
    expect(await enforceClientRateLimit(req("1.2.3.4"), envWith(limit))).toBeNull();
    expect(limit).toHaveBeenCalledWith({ key: "1.2.3.4" });
  });

  it("falls back to a shared key when the IP header is absent (local dev)", async () => {
    const limit = vi.fn(async () => ({ success: true }));
    await enforceClientRateLimit(req(), envWith(limit));
    expect(limit).toHaveBeenCalledWith({ key: "unkeyed" });
  });

  it("returns a 429 envelope with Retry-After when over the limit", async () => {
    const res = await enforceClientRateLimit(req("1.2.3.4"), envWith(async () => ({ success: false })));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toBe("15");
    const body = (await res!.json()) as { ok: boolean; error: { code: string; retryAfter: number } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.retryAfter).toBe(15);
  });

  it("fails open when the limiter itself throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await enforceClientRateLimit(
      req("1.2.3.4"),
      envWith(async () => {
        throw new Error("limiter down");
      }),
    );
    expect(res).toBeNull();
    spy.mockRestore();
  });
});
