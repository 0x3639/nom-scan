import type { RouteHandler } from "../router";
import { withCache } from "../cache";
import { ok, err, errorFromThrown } from "../respond";
import { getToken } from "../services/tokens";

export const getTokenMeta: RouteHandler = async (request, env, _ctx, params) => {
  const standard = params["standard"] ?? "";
  if (!standard) return err("bad_request", "Missing token_standard.", 400);

  return withCache(request, 24 * 60 * 60, async () => {
    try {
      const meta = await getToken(env, standard);
      if (!meta) return err("not_found", "Token not found.", 404);
      return ok(meta);
    } catch (e) {
      return errorFromThrown(e);
    }
  });
};
