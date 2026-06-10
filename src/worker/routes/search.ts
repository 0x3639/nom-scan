import type { RouteHandler } from "../router";
import { nomIndexerFetch } from "../upstream";
import { ok, err, errorFromThrown } from "../respond";
import { UpstreamError } from "../errors";
import { detectQueryType, normalizeAddress, normalizeHash, normalizeMomentum } from "@shared/validate/identifier";
import type { SearchResult } from "@shared/api/nomscan";

/** True when the upstream object exists; false on its 404; rethrows anything else. */
async function existsUpstream(env: import("../env").Env, path: string): Promise<boolean> {
  try {
    await nomIndexerFetch(env, path);
    return true;
  } catch (e) {
    if (e instanceof UpstreamError && e.status === 404) return false;
    throw e;
  }
}

const existsAccount = (env: import("../env").Env, address: string) =>
  existsUpstream(env, `/api/v1/accounts/${encodeURIComponent(address)}`);
const existsAccountBlock = (env: import("../env").Env, hash: string) =>
  existsUpstream(env, `/api/v1/account_blocks/${encodeURIComponent(hash)}`);
const existsMomentum = (env: import("../env").Env, height: string) =>
  existsUpstream(env, `/api/v1/momentums/${encodeURIComponent(height)}`);

export const getSearch: RouteHandler = async (request, env) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return err("bad_request", "Missing query.", 400);

  const kind = detectQueryType(q);

  try {
    if (kind === "address") {
      const exists = await existsAccount(env, normalizeAddress(q));
      return ok<SearchResult>(exists ? { kind: "address", target: normalizeAddress(q) } : { kind: "not_found" });
    }
    if (kind === "hash") {
      const exists = await existsAccountBlock(env, normalizeHash(q));
      return ok<SearchResult>(exists ? { kind: "tx", target: normalizeHash(q) } : { kind: "not_found" });
    }
    if (kind === "momentum") {
      const height = normalizeMomentum(q);
      const exists = await existsMomentum(env, height);
      return ok<SearchResult>(exists ? { kind: "momentum", target: height } : { kind: "not_found" });
    }
    if (kind === "ambiguous") {
      const [asAddress, asHash] = await Promise.all([
        existsAccount(env, normalizeAddress(q)),
        existsAccountBlock(env, normalizeHash(q)),
      ]);
      if (asAddress) return ok<SearchResult>({ kind: "address", target: normalizeAddress(q) });
      if (asHash) return ok<SearchResult>({ kind: "tx", target: normalizeHash(q) });
      return ok<SearchResult>({ kind: "not_found" });
    }
    return ok<SearchResult>({ kind: "not_found" });
  } catch (e) {
    // errorFromThrown maps UpstreamError and logs + 500s anything else.
    return errorFromThrown(e);
  }
};
