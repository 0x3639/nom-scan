import type { RouteHandler } from "../router";
import { nomIndexerFetch } from "../upstream";
import { ok, err, errorFromThrown } from "../respond";
import { isMomentumHeight, normalizeMomentum } from "@shared/validate/identifier";
import type { MomentumDetail } from "@shared/api/nomscan";

export const getMomentum: RouteHandler = async (_request, env, _ctx, params) => {
  const heightStr = params["height"] ?? "";
  if (!isMomentumHeight(heightStr)) {
    return err("bad_request", "Invalid or missing momentum height.", 400);
  }
  // normalizeMomentum strips commas so a direct /api/momentum/12,708,298 hit
  // doesn't Number()-coerce to NaN.
  const height = Number(normalizeMomentum(heightStr));

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
