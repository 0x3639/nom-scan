import type { RouteHandler } from "../router";
import { nomIndexerFetch } from "../upstream";
import { withCache } from "../cache";
import { ok, err, errorFromThrown } from "../respond";
import { getToken } from "../services/tokens";
import { isAddress } from "@shared/validate/identifier";
import type { AddressSummary, BalanceEntry, NomScanPagination, TxRow } from "@shared/api/nomscan";

interface UpstreamCollection<T> {
  data: T[];
  pagination?: NomScanPagination;
}

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;
const TX_CACHE_PAGE1_DESC_SECONDS = 5;
const TX_CACHE_PAGE1_ASC_SECONDS = 24 * 60 * 60;
const TX_CACHE_OLDER_SECONDS = 300;

// Exported for unit testing — the page_size max-200 clamp is a non-negotiable
// upstream contract requirement.
export function clampPageSize(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
}

export function clampPage(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

export const getAddressSummary: RouteHandler = async (_request, env, _ctx, params) => {
  const address = params["address"] ?? "";
  if (!isAddress(address)) return err("bad_request", "Invalid or missing address.", 400);
  try {
    const summary = await nomIndexerFetch<AddressSummary>(
      env,
      `/api/v1/accounts/${encodeURIComponent(address)}`,
    );
    return ok(summary);
  } catch (e) {
    return errorFromThrown(e);
  }
};

export const getAddressBalances: RouteHandler = async (_request, env, _ctx, params) => {
  const address = params["address"] ?? "";
  if (!isAddress(address)) return err("bad_request", "Invalid or missing address.", 400);
  try {
    const raw = await nomIndexerFetch<BalanceEntry[] | UpstreamCollection<BalanceEntry>>(
      env,
      `/api/v1/accounts/${encodeURIComponent(address)}/balances`,
    );
    const entries: BalanceEntry[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const standard = entry.token_standard;
        if (!standard) return entry;
        const meta = await getToken(env, standard).catch(() => null);
        return meta ? { ...entry, token: meta } : entry;
      }),
    );
    return ok(enriched);
  } catch (e) {
    return errorFromThrown(e);
  }
};

export const getAddressTransactions: RouteHandler = async (request, env, _ctx, params) => {
  const address = params["address"] ?? "";
  if (!isAddress(address)) return err("bad_request", "Invalid or missing address.", 400);

  const url = new URL(request.url);
  const page = clampPage(url.searchParams.get("page"));
  const pageSize = clampPageSize(url.searchParams.get("page_size"));
  const sort = (url.searchParams.get("sort") ?? "desc") === "asc" ? "asc" : "desc";

  // Historical pages are effectively immutable. Page 1 desc holds the newest tx
  // and grows with new activity (short TTL). Page 1 asc holds the very first tx
  // ever, which never changes (long TTL). Pages 2+ are historical (medium TTL).
  const ttl =
    page === 1
      ? sort === "asc"
        ? TX_CACHE_PAGE1_ASC_SECONDS
        : TX_CACHE_PAGE1_DESC_SECONDS
      : TX_CACHE_OLDER_SECONDS;

  return withCache(request, ttl, async () => {
    try {
      const upstream = await nomIndexerFetch<UpstreamCollection<TxRow> | TxRow[]>(
        env,
        `/api/v1/accounts/${encodeURIComponent(address)}/transactions?page=${page}&page_size=${pageSize}&sort=${sort}`,
      );
      const entries: TxRow[] = Array.isArray(upstream) ? upstream : (upstream?.data ?? []);
      const pagination: NomScanPagination =
        !Array.isArray(upstream) && upstream?.pagination
          ? upstream.pagination
          : { page, page_size: pageSize };

      // Token metadata is fetched per-standard by the client via /api/tokens/:std
      // (24h Worker cache + 5min TanStack cache, deduped across rows). Enriching
      // here would block the response on N upstream calls before first paint.
      return ok(entries, pagination);
    } catch (e) {
      return errorFromThrown(e);
    }
  });
};
