/**
 * Read-through Cache API helper. Caches the produced Response under
 * `canonicalUrl` (or the raw request URL) for `ttlSeconds`. Skips cache for
 * non-GET methods.
 *
 * Routes that clamp query params should pass a `canonicalUrl` rebuilt from the
 * *clamped* values: keying on the raw URL lets junk params (`?page_size=201`,
 * `?x=1`, …) mint unbounded distinct cache entries that all miss and each hit
 * the rate-limited upstream.
 *
 * `ttlSeconds` may be a thunk, evaluated after the producer runs, so a route
 * can pick the TTL based on what the upstream actually returned.
 */
export async function withCache(
  request: Request,
  ttlSeconds: number | (() => number),
  producer: () => Promise<Response>,
  canonicalUrl?: string,
): Promise<Response> {
  if (request.method !== "GET") return producer();

  const cache = caches.default;
  const cacheKey = new Request(canonicalUrl ?? request.url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const fresh = await producer();
  if (fresh.ok) {
    const ttl = typeof ttlSeconds === "function" ? ttlSeconds() : ttlSeconds;
    const cacheable = new Response(fresh.clone().body, fresh);
    cacheable.headers.set("Cache-Control", `public, max-age=${ttl}, s-maxage=${ttl}`);
    await cache.put(cacheKey, cacheable);
  }
  return fresh;
}
