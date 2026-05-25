/**
 * Read-through Cache API helper. Caches the produced Response under the
 * request URL for `ttlSeconds`. Skips cache for non-GET methods.
 */
export async function withCache(
  request: Request,
  ttlSeconds: number,
  producer: () => Promise<Response>,
): Promise<Response> {
  if (request.method !== "GET") return producer();

  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const fresh = await producer();
  if (fresh.ok) {
    const cacheable = new Response(fresh.clone().body, fresh);
    cacheable.headers.set("Cache-Control", `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`);
    await cache.put(cacheKey, cacheable);
  }
  return fresh;
}
