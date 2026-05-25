import type { RouteHandler } from "../router";
import { nomIndexerFetch } from "../upstream";
import { ok, err, errorFromThrown } from "../respond";
import { getToken } from "../services/tokens";
import type { TxDetail } from "@shared/api/pfscan";

export const getTransaction: RouteHandler = async (_request, env, _ctx, params) => {
  const hash = params["hash"] ?? "";
  if (!hash) return err("bad_request", "Missing transaction hash.", 400);
  try {
    const detail = await nomIndexerFetch<TxDetail>(
      env,
      `/api/v1/account_blocks/${encodeURIComponent(hash)}`,
    );
    if (detail?.token_standard) {
      const meta = await getToken(env, detail.token_standard).catch(() => null);
      if (meta) detail.token = meta;
    }
    return ok(detail);
  } catch (e) {
    return errorFromThrown(e);
  }
};
