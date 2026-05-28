import type { RouteHandler } from "../router";
import { nomIndexerFetch } from "../upstream";
import { ok, err, errorFromThrown } from "../respond";
import { getToken } from "../services/tokens";
import { isHash, normalizeHash } from "@shared/validate/identifier";
import type { TxDetail } from "@shared/api/pfscan";

export const getTransaction: RouteHandler = async (_request, env, _ctx, params) => {
  const hash = params["hash"] ?? "";
  if (!isHash(hash)) return err("bad_request", "Invalid or missing transaction hash.", 400);
  try {
    const detail = await nomIndexerFetch<TxDetail>(
      env,
      `/api/v1/account_blocks/${encodeURIComponent(normalizeHash(hash))}`,
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
