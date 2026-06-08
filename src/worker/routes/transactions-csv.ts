import type { RouteHandler } from "../router";
import { nomIndexerFetch } from "../upstream";
import { errorFromThrown, err } from "../respond";
import { getToken } from "../services/tokens";
import { isAddress } from "@shared/validate/identifier";
import { getDirection } from "@shared/logic/direction";
import { formatAmount } from "@shared/format/amount";
import type { NomScanPagination, TokenMeta, TxRow } from "@shared/api/nomscan";

interface UpstreamCollection<T> {
  data: T[];
  pagination?: NomScanPagination;
}

const PAGE_SIZE = 200;
const MAX_PAGES = 50; // 50 * 200 = 10,000 row cap (newest first)
const MAX_ROWS = MAX_PAGES * PAGE_SIZE;

const CSV_COLUMNS = [
  "tx_hash", "direction", "block_type", "method", "timestamp_utc",
  "timestamp_unix", "from_address", "to_address", "amount", "token_symbol",
  "amount_raw", "token_standard", "momentum_height", "momentum_hash",
] as const;

// Quote every field and double internal quotes; neutralize spreadsheet formula
// injection by prefixing a leading = + - @ with a single quote. Exported for tests.
export function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function isoUtc(seconds: number | null | undefined): string {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : "";
}

export const getAddressTransactionsCsv: RouteHandler = async (_request, env, _ctx, params) => {
  const address = params["address"] ?? "";
  if (!isAddress(address)) return err("bad_request", "Invalid or missing address.", 400);

  try {
    // 1. Paginate newest-first until a short page, the row cap, or MAX_PAGES.
    const rows: TxRow[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const upstream = await nomIndexerFetch<UpstreamCollection<TxRow> | TxRow[]>(
        env,
        `/api/v1/accounts/${encodeURIComponent(address)}/transactions?page=${page}&page_size=${PAGE_SIZE}&sort=desc`,
      );
      const entries: TxRow[] = Array.isArray(upstream) ? upstream : (upstream?.data ?? []);
      rows.push(...entries);
      if (entries.length < PAGE_SIZE) break;
      if (rows.length >= MAX_ROWS) break;
    }
    const capped = rows.slice(0, MAX_ROWS);

    // 2. Resolve unique token metadata once each.
    const standards = [...new Set(capped.map((r) => r.token_standard).filter((s): s is string => Boolean(s)))];
    const tokens = new Map<string, TokenMeta>();
    await Promise.all(
      standards.map(async (s) => {
        const meta = await getToken(env, s).catch(() => null);
        if (meta) tokens.set(s, meta);
      }),
    );

    // 3. Build the CSV.
    const header = CSV_COLUMNS.map((c) => csvCell(c)).join(",");
    const lines = [header];
    for (const row of capped) {
      const meta = row.token_standard ? tokens.get(row.token_standard) : undefined;
      const decimals = meta?.decimals ?? 8;
      const ts = row.momentum_timestamp ?? row.timestamp ?? null;
      const amount =
        row.amount != null && row.amount !== ""
          ? formatAmount(row.amount, decimals, { group: false, maxFractionDigits: decimals })
          : "";
      lines.push(
        [
          csvCell(row.hash),
          csvCell(getDirection(row, address)),
          csvCell(row.block_type ?? ""),
          csvCell(row.method ?? ""),
          csvCell(isoUtc(ts)),
          csvCell(typeof ts === "number" ? ts : ""),
          csvCell(row.address),
          csvCell(row.to_address ?? ""),
          csvCell(amount),
          csvCell(meta?.symbol ?? ""),
          csvCell(row.amount ?? ""),
          csvCell(row.token_standard ?? ""),
          csvCell(row.momentum_height ?? ""),
          csvCell(row.momentum_hash ?? ""),
        ].join(","),
      );
    }
    const csv = lines.join("\r\n");

    const date = new Date().toISOString().slice(0, 10);
    const filename = `nomscan-${address.slice(0, 12)}-transactions-${date}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorFromThrown(e);
  }
};
