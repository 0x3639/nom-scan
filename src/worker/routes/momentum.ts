import type { RouteHandler } from "../router";
import { nomIndexerFetch } from "../upstream";
import { ok, err, errorFromThrown } from "../respond";
import type { MomentumDetail } from "@shared/api/pfscan";

// Positive integer, no leading zero, capped length. Mirrors MOMENTUM_RE in
// the shared identifier validator.
const HEIGHT_RE = /^[1-9]\d{0,17}$/;

export const getMomentum: RouteHandler = async (_request, env, _ctx, params) => {
  const heightStr = params["height"] ?? "";
  if (!HEIGHT_RE.test(heightStr)) {
    return err("bad_request", "Invalid or missing momentum height.", 400);
  }
  const height = Number(heightStr);

  try {
    // Fetch the momentum and (when applicable) its predecessor in parallel.
    // The predecessor is best-effort: only used to derive previous_hash, so a
    // failure there must not fail the page.
    const [momentum, previous] = await Promise.all([
      nomIndexerFetch<MomentumDetail>(env, `/api/v1/momentums/${height}`),
      height > 1
        ? nomIndexerFetch<MomentumDetail>(env, `/api/v1/momentums/${height - 1}`).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (previous?.hash) momentum.previous_hash = previous.hash;
    return ok(momentum);
  } catch (e) {
    return errorFromThrown(e);
  }
};
