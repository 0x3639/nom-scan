import type { Env } from "./env";
import { err } from "./respond";

/**
 * The limiter window is 60s but per-colo and sliding-ish; 15s is a reasonable
 * middle-ground hint for the client's retry countdown.
 */
const RETRY_AFTER_SECONDS = 15;

/**
 * Per-client fairness gate for /api/*. The upstream indexer rate-limits per
 * JWT subject and every end user shares the single `nomscan` subject, so
 * without this one greedy client could starve everyone else's API access.
 *
 * Keyed on CF-Connecting-IP (the only client identity available pre-Phase-3).
 * Returns a 429 envelope Response when over the limit, null to proceed.
 *
 * Fails OPEN: a missing binding or a limiter error must never take the API
 * down — the upstream's own per-subject limit remains the hard backstop.
 *
 * NOTE: @cloudflare/vite-plugin (0.1.x) strips ratelimit bindings from local
 * dev, so `npm run dev` always fail-opens here. The enforcement path is
 * covered by unit tests plus a miniflare smoke test of the built bundle;
 * production workerd enforces for real.
 */
export async function enforceClientRateLimit(request: Request, env: Env): Promise<Response | null> {
  const limiter = env.API_LIMITER;
  if (!limiter) return null;

  // Absent header (local dev, tests) → one shared bucket, which still
  // exercises the gate locally rather than silently bypassing it.
  const key = request.headers.get("CF-Connecting-IP") ?? "unkeyed";

  try {
    const { success } = await limiter.limit({ key });
    if (success) return null;
  } catch (e) {
    console.error("[nomscan] rate limiter error:", e);
    return null;
  }

  return err(
    "rate_limited",
    "Too many requests from your connection. Please retry shortly.",
    429,
    RETRY_AFTER_SECONDS,
  );
}
