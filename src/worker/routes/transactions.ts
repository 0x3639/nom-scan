import type { RouteHandler } from "../router";
import { nomIndexerFetch } from "../upstream";
import { withCache } from "../cache";
import { ok, errorFromThrown } from "../respond";
import type { NomScanPagination, TxRow } from "@shared/api/nomscan";

interface UpstreamCollection<T> {
  data: T[];
  pagination?: NomScanPagination;
}

const ALLOWED_PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 10;
// Page 1 desc is the live "latest" view and changes often; everything else is
// effectively historical. Mirrors the TTL split in routes/address.ts.
const PAGE1_DESC_SECONDS = 5;
const OLDER_SECONDS = 300;

// page_size is constrained to the dropdown's fixed options; any other value
// falls back to the default. Exported for unit testing.
export function clampAllowedPageSize(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

export function clampPage(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

export const getTransactions: RouteHandler = async (request, env, _ctx) => {
  const url = new URL(request.url);
  const page = clampPage(url.searchParams.get("page"));
  const pageSize = clampAllowedPageSize(url.searchParams.get("page_size"));
  const sort = (url.searchParams.get("sort") ?? "desc") === "asc" ? "asc" : "desc";

  const ttl = page === 1 && sort === "desc" ? PAGE1_DESC_SECONDS : OLDER_SECONDS;

  return withCache(request, ttl, async () => {
    try {
      const upstream = await nomIndexerFetch<UpstreamCollection<TxRow> | TxRow[]>(
        env,
        `/api/v1/account_blocks?page=${page}&page_size=${pageSize}&sort=${sort}`,
      );
      const entries: TxRow[] = Array.isArray(upstream) ? upstream : (upstream?.data ?? []);
      const pagination: NomScanPagination =
        !Array.isArray(upstream) && upstream?.pagination
          ? upstream.pagination
          : { page, page_size: pageSize };
      return ok(entries, pagination);
    } catch (e) {
      return errorFromThrown(e);
    }
  });
};
