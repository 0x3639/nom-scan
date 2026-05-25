import type { RouteHandler } from "../router";
import { nomIndexerFetch } from "../upstream";
import { withCache } from "../cache";
import { ok } from "../respond";
import { errorFromThrown } from "../respond";

interface UpstreamStatus {
  // Loose typing — we mirror the indexer's shape into our envelope.
  [key: string]: unknown;
}

export const getStatus: RouteHandler = async (request, env) => {
  return withCache(request, 5, async () => {
    try {
      const upstream = await nomIndexerFetch<UpstreamStatus>(env, "/api/v1/status");
      return ok(upstream);
    } catch (e) {
      return errorFromThrown(e);
    }
  });
};
