import type { RouteHandler } from "../router";
import { withCache } from "../cache";
import { ok, err, errorFromThrown } from "../respond";
import { getToken } from "../services/tokens";
import { isTokenStandard } from "@shared/validate/identifier";

export const getTokenMeta: RouteHandler = async (request, env, _ctx, params) => {
  const standard = params["standard"] ?? "";
  // Strict format check before this hits the rate-limited upstream and the 24h
  // edge cache — arbitrary strings would mint unbounded cache entries and burn
  // the upstream budget on guaranteed misses.
  if (!isTokenStandard(standard)) {
    return err("bad_request", "Invalid or missing token_standard.", 400);
  }

  const url = new URL(request.url);
  const canonicalUrl = `${url.origin}${url.pathname}`;

  return withCache(
    request,
    24 * 60 * 60,
    async () => {
      try {
        const meta = await getToken(env, standard);
        if (!meta) return err("not_found", "Token not found.", 404);
        return ok(meta);
      } catch (e) {
        return errorFromThrown(e);
      }
    },
    canonicalUrl,
  );
};
