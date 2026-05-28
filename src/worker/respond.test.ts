import { describe, expect, it, vi } from "vitest";
import { err, errorFromThrown, ok } from "./respond";
import { UpstreamError } from "./errors";

describe("ok", () => {
  it("shapes a success envelope without pagination", async () => {
    const res = ok({ a: 1 });
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as { ok: boolean; data: unknown; pagination?: unknown };
    expect(body).toEqual({ ok: true, data: { a: 1 } });
    expect(body.pagination).toBeUndefined();
  });

  it("includes pagination when provided", async () => {
    const res = ok([1, 2], { page: 1, page_size: 50 });
    const body = (await res.json()) as { pagination: unknown };
    expect(body.pagination).toEqual({ page: 1, page_size: 50 });
  });
});

describe("err", () => {
  it("sets status, error body, and Retry-After header", async () => {
    const res = err("rate_limited", "slow down", 429, 30);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    const body = (await res.json()) as { error: unknown };
    expect(body.error).toEqual({ code: "rate_limited", message: "slow down", status: 429, retryAfter: 30 });
  });

  it("omits retryAfter and the Retry-After header when not given", async () => {
    const res = err("bad_request", "nope", 400);
    expect(res.headers.get("Retry-After")).toBeNull();
    const body = (await res.json()) as { error: { retryAfter?: number } };
    expect(body.error.retryAfter).toBeUndefined();
  });
});

describe("errorFromThrown", () => {
  it("maps UpstreamError to a user-safe reply without leaking the raw message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorFromThrown(new UpstreamError(429, "raw upstream detail leak", null, 5));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.message).not.toContain("raw upstream detail");
    spy.mockRestore();
  });

  it("maps a generic Error to a 500 internal reply", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorFromThrown(new Error("boom"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: unknown };
    expect(body.error).toEqual({ code: "internal", message: "Something went wrong.", status: 500 });
    spy.mockRestore();
  });
});
