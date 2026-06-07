import type { RouteHandler } from "../router";
import { err } from "../respond";
import type { PriceMap } from "@shared/api/nomscan";

const UPSTREAM = "https://api.zenon.info/price";
/** How long the served response is treated as fresh by the edge + the browser. */
const FRESH_TTL_SECONDS = 60;
/** How long we hold onto last-known-good prices to fill upstream gaps. */
const LAST_KNOWN_TTL_SECONDS = 5 * 60;
/** Cache-API key for the last-known-good merged price map (constant; not a real URL). */
const LAST_KNOWN_KEY = "https://nomscan.internal/_last-known-prices";

interface UpstreamShape {
  data?: Record<string, { usd?: number; timestamp?: string }>;
}

async function fetchUpstreamPrices(): Promise<PriceMap | null> {
  try {
    const res = await fetch(UPSTREAM, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      console.error(`[nomscan] price upstream ${res.status}`);
      return null;
    }
    const body = (await res.json()) as UpstreamShape;
    const out: PriceMap = {};
    for (const [symbol, entry] of Object.entries(body.data ?? {})) {
      if (entry && typeof entry.usd === "number" && Number.isFinite(entry.usd)) {
        out[symbol.toLowerCase()] = entry.usd;
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch (e) {
    console.error("[nomscan] price fetch error:", e);
    return null;
  }
}

async function readLastKnown(): Promise<PriceMap> {
  const hit = await caches.default.match(LAST_KNOWN_KEY);
  if (!hit) return {};
  try {
    const body = (await hit.json()) as { ok?: boolean; data?: PriceMap };
    return body?.data ?? {};
  } catch {
    return {};
  }
}

function jsonResponse(payload: string, ttlSeconds: number): Response {
  return new Response(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`,
    },
  });
}

export const getPrices: RouteHandler = async (request, _env, ctx) => {
  const cache = caches.default;
  const freshKey = new Request(new URL("/api/prices", request.url).toString(), { method: "GET" });

  // 1) Serve the fresh-cache (≤60s old) if hot.
  const hot = await cache.match(freshKey);
  if (hot) return hot;

  // 2) Pull upstream + last-known-good in parallel.
  const [upstream, lastKnown] = await Promise.all([fetchUpstreamPrices(), readLastKnown()]);

  // 3) Merge: upstream wins per-key, last-known fills gaps. If upstream is null
  //    (network/HTTP failure), serve last-known unchanged.
  const merged: PriceMap = upstream ? { ...lastKnown, ...upstream } : { ...lastKnown };

  if (Object.keys(merged).length === 0) {
    return err("upstream_unavailable", "Price feed unavailable.", 503);
  }

  const payload = JSON.stringify({ ok: true, data: merged });

  // 4) Persist:
  //    - Fresh-cache the served response under the public URL (60s).
  //    - If we actually got fresh upstream data, refresh the long-lived
  //      last-known cache (5 min) with the merged map. Don't extend the TTL
  //      if upstream failed — we want stale data to age out eventually.
  ctx.waitUntil(cache.put(freshKey, jsonResponse(payload, FRESH_TTL_SECONDS)));
  if (upstream) {
    ctx.waitUntil(cache.put(LAST_KNOWN_KEY, jsonResponse(payload, LAST_KNOWN_TTL_SECONDS)));
  }

  return jsonResponse(payload, FRESH_TTL_SECONDS);
};
