import type { Env } from "../env";
import { nomIndexerFetch } from "../upstream";
import { UpstreamError } from "../errors";
import type { TokenMeta } from "@shared/api/pfscan";

/**
 * Fetch token metadata. Per-isolate in-memory cache so balance/tx enrichment
 * doesn't trip the upstream rate limit on repeated lookups within a request burst.
 * Cache TTL is short (10 min) because token metadata is stable but symbol/decimals
 * could in theory change. The /api/tokens/:standard route uses a longer Cache API TTL.
 */
interface CachedToken {
  meta: TokenMeta;
  expiresAt: number;
}
const memo = new Map<string, CachedToken>();
const TTL_MS = 10 * 60 * 1000;

export async function getToken(env: Env, standard: string): Promise<TokenMeta | null> {
  if (!standard) return null;
  const now = Date.now();
  const hit = memo.get(standard);
  if (hit && hit.expiresAt > now) return hit.meta;

  try {
    const meta = await nomIndexerFetch<TokenMeta>(env, `/api/v1/tokens/${encodeURIComponent(standard)}`);
    memo.set(standard, { meta, expiresAt: now + TTL_MS });
    return meta;
  } catch (e) {
    if (e instanceof UpstreamError && e.status === 404) return null;
    throw e;
  }
}
