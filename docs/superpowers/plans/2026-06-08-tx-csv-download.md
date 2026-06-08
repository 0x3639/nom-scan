# Address Transactions CSV Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Download CSV" button to an address's Transactions tab that exports all of that address's account-blocks (capped at the newest 10,000) as a CSV with both formatted and raw amount columns.

**Architecture:** A new Worker route `GET /api/address/:address/transactions.csv` paginates the indexer's `/api/v1/accounts/{address}/transactions` (200/page, newest-first) up to 50 pages, enriches token metadata via the existing tokens service, and returns a CSV-injection-safe `text/csv` attachment. A new `DownloadCsvButton` in the Transactions tab fetches it, shows a "Preparing…" state, and saves the file.

**Tech Stack:** Cloudflare Worker (TypeScript), React + TypeScript SPA, Vitest. Reuses `formatAmount`, `getDirection`, and the `getToken` tokens service server-side.

**Spec:** `docs/superpowers/specs/2026-06-08-tx-csv-download-design.md`

**Branch:** `feat/tx-csv-download` (already created and checked out).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/worker/routes/transactions-csv.ts` (create) | CSV route: paginate, enrich tokens, build CSV-injection-safe CSV, return attachment. Plus exported `csvCell` + `buildCsv` helpers for testing. |
| `src/worker/routes/transactions-csv.test.ts` (create) | Unit tests for aggregation, cap, columns, direction, escaping, errors. |
| `src/worker/index.ts` (modify) | Register `.get("/api/address/:address/transactions.csv", getAddressTransactionsCsv)`. |
| `src/app/components/address/DownloadCsvButton.tsx` (create) | Button: confirm-on-cap, fetch, loading/error state, Blob save. |
| `src/app/components/address/DownloadCsvButton.module.css` (create) | Button styles. |
| `src/app/components/address/TransactionsTab.tsx` (modify) | Render the button in the summary header, passing `address` + `total`. |
| `src/app/components/address/TransactionsTab.module.css` (modify) | Lay out the summary row with the button on the right. |

---

## Task 1: Worker CSV route + helpers + tests

**Files:**
- Create: `src/worker/routes/transactions-csv.ts`
- Test: `src/worker/routes/transactions-csv.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/worker/routes/transactions-csv.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { UpstreamError } from "../errors";

vi.mock("../upstream", () => ({ nomIndexerFetch: vi.fn() }));
import { nomIndexerFetch } from "../upstream";
vi.mock("../services/tokens", () => ({ getToken: vi.fn() }));
import { getToken } from "../services/tokens";

import { getAddressTransactionsCsv, csvCell } from "./transactions-csv";

const env = {} as Env;
const ctx = {} as ExecutionContext;
const ADDR = "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp";
const OTHER = "z1qzqajuhyfqkk4fy2z3ls0x29quyetkvqfd6n4x";

function req(address: string): Request {
  return new Request(`https://x/api/address/${address}/transactions.csv`);
}

// One upstream page of `n` rows; each row sends ADDR -> OTHER, 1.0 ZNN.
function page(n: number, startHeight = 0) {
  const data = Array.from({ length: n }, (_, i) => ({
    hash: `h${startHeight + i}`,
    block_type: 2,
    method: "",
    momentum_timestamp: 1700000000 + i,
    address: ADDR,
    to_address: OTHER,
    amount: "100000000",
    token_standard: "zts1znnxxxxxxxxxxxxx9z4ulx",
    momentum_height: startHeight + i,
    momentum_hash: `m${startHeight + i}`,
  }));
  return { data, pagination: { page: 1, page_size: 200 } };
}

const ZNN_META = {
  token_standard: "zts1znnxxxxxxxxxxxxx9z4ulx",
  name: "Zenon",
  symbol: "ZNN",
  decimals: 8,
};

describe("csvCell", () => {
  it("wraps every value in quotes and doubles internal quotes", () => {
    expect(csvCell("abc")).toBe('"abc"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(123)).toBe('"123"');
  });
  it("neutralizes leading formula characters", () => {
    expect(csvCell("=cmd")).toBe('"\'=cmd"');
    expect(csvCell("+1")).toBe('"\'+1"');
    expect(csvCell("-1")).toBe('"\'-1"');
    expect(csvCell("@x")).toBe('"\'@x"');
  });
});

describe("getAddressTransactionsCsv", () => {
  beforeEach(() => {
    vi.mocked(nomIndexerFetch).mockReset();
    vi.mocked(getToken).mockReset();
    vi.mocked(getToken).mockResolvedValue(ZNN_META);
  });

  it("400s on an invalid address", async () => {
    const res = await getAddressTransactionsCsv(req("not-an-address"), env, ctx, {
      address: "not-an-address",
    });
    expect(res.status).toBe(400);
  });

  it("aggregates pages, stops on a short page, and emits header + data rows", async () => {
    vi.mocked(nomIndexerFetch)
      .mockResolvedValueOnce(page(200, 0))
      .mockResolvedValueOnce(page(30, 200)); // short page -> stop
    const res = await getAddressTransactionsCsv(req(ADDR), env, ctx, { address: ADDR });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const text = await res.text();
    const lines = text.trim().split("\r\n");
    expect(lines).toHaveLength(1 + 230); // header + 230 rows
    expect(lines[0]).toBe(
      [
        "tx_hash", "direction", "block_type", "method", "timestamp_utc",
        "timestamp_unix", "from_address", "to_address", "amount", "token_symbol",
        "amount_raw", "token_standard", "momentum_height", "momentum_hash",
      ].map((h) => `"${h}"`).join(","),
    );
    // Only two upstream pages fetched (short page ended the loop).
    expect(vi.mocked(nomIndexerFetch)).toHaveBeenCalledTimes(2);
  });

  it("formats amount via token decimals, includes raw amount, and computes OUT direction", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValueOnce(page(1, 0));
    const res = await getAddressTransactionsCsv(req(ADDR), env, ctx, { address: ADDR });
    const row = (await res.text()).trim().split("\r\n")[1];
    // OUT (sender==ADDR), amount "1" (100000000 @ 8 decimals), symbol ZNN, raw passthrough.
    expect(row).toContain('"OUT"');
    expect(row).toContain('"1"');
    expect(row).toContain('"ZNN"');
    expect(row).toContain('"100000000"');
  });

  it("enforces the 50-page / 10,000-row cap", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue(page(200, 0)); // always full
    const res = await getAddressTransactionsCsv(req(ADDR), env, ctx, { address: ADDR });
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines).toHaveLength(1 + 10000);
    expect(vi.mocked(nomIndexerFetch)).toHaveBeenCalledTimes(50);
  });

  it("returns a JSON error (not CSV) when upstream fails", async () => {
    vi.mocked(nomIndexerFetch).mockRejectedValue(new UpstreamError(500, "boom", null, null));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await getAddressTransactionsCsv(req(ADDR), env, ctx, { address: ADDR });
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:worker -- transactions-csv`
Expected: FAIL — `Failed to load url ./transactions-csv` (module not created yet).

- [ ] **Step 3: Write the implementation**

Create `src/worker/routes/transactions-csv.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:worker -- transactions-csv`
Expected: PASS — `csvCell` and all `getAddressTransactionsCsv` cases green.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (If the test trips `noUncheckedIndexedAccess` on `split("\r\n")[1]`, change those reads to `.split("\r\n").at(1)` with a non-null assertion or guard — minimal behavior-preserving fix.)

- [ ] **Step 6: Commit**

```bash
git add src/worker/routes/transactions-csv.ts src/worker/routes/transactions-csv.test.ts
git commit -m "feat(worker): add /api/address/:address/transactions.csv export route"
```

---

## Task 2: Register the route

**Files:**
- Modify: `src/worker/index.ts`

- [ ] **Step 1: Add the import**

In `src/worker/index.ts`, after `import { getTransactions } from "./routes/transactions";` add:

```ts
import { getAddressTransactionsCsv } from "./routes/transactions-csv";
```

- [ ] **Step 2: Register the route**

In the `new ApiRouter()` chain, add the CSV route directly after the
`.get("/api/address/:address/transactions", getAddressTransactions)` line:

```ts
  .get("/api/address/:address/transactions", getAddressTransactions)
  .get("/api/address/:address/transactions.csv", getAddressTransactionsCsv)
```

(URLPattern matches `transactions.csv` distinctly from `transactions`; order is not critical but keep them adjacent.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/worker/index.ts
git commit -m "feat(worker): register transactions.csv route"
```

---

## Task 3: DownloadCsvButton component

**Files:**
- Create: `src/app/components/address/DownloadCsvButton.tsx`
- Create: `src/app/components/address/DownloadCsvButton.module.css`

- [ ] **Step 1: Create the component**

Create `src/app/components/address/DownloadCsvButton.tsx`:

```tsx
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import styles from "./DownloadCsvButton.module.css";

const ROW_CAP = 10000;

interface Props {
  address: string;
  /** Known transaction count, used to warn when the export will be capped. */
  txCount?: number;
}

export function DownloadCsvButton({ address, txCount }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function download() {
    if (typeof txCount === "number" && txCount > ROW_CAP) {
      const ok = window.confirm(
        `This address has ${txCount.toLocaleString()} transactions. Only the newest ${ROW_CAP.toLocaleString()} will be exported. Continue?`,
      );
      if (!ok) return;
    }
    setStatus("loading");
    try {
      const res = await fetch(`/api/address/${encodeURIComponent(address)}/transactions.csv`);
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/csv")) {
        throw new Error("export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nomscan-${address.slice(0, 12)}-transactions-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("idle");
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 4000);
    }
  }

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={() => void download()}
      disabled={status === "loading"}
      aria-label="Download transactions as CSV"
    >
      {status === "loading" ? (
        <Loader2 size={14} aria-hidden className={styles.spin} />
      ) : (
        <Download size={14} aria-hidden />
      )}
      <span aria-live="polite">
        {status === "loading" ? "Preparing…" : status === "error" ? "Try again" : "Download CSV"}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Create the styles**

Create `src/app/components/address/DownloadCsvButton.module.css`:

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 120ms, border-color 120ms, color 120ms;
}
.btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-text);
}
.btn:disabled {
  opacity: 0.7;
  cursor: default;
}

.spin {
  animation: spin 800ms linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/app/components/address/DownloadCsvButton.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/address/DownloadCsvButton.tsx src/app/components/address/DownloadCsvButton.module.css
git commit -m "feat(app): add DownloadCsvButton component"
```

---

## Task 4: Wire the button into the Transactions tab

**Files:**
- Modify: `src/app/components/address/TransactionsTab.tsx`
- Modify: `src/app/components/address/TransactionsTab.module.css`

- [ ] **Step 1: Import the button**

In `src/app/components/address/TransactionsTab.tsx`, after the line
`import { Pagination } from "../Pagination";` add:

```tsx
import { DownloadCsvButton } from "./DownloadCsvButton";
```

- [ ] **Step 2: Render the button in the summary header**

In `TransactionsTab.tsx`, replace the success-state summary block:

```tsx
      {typeof total === "number" ? (
        <div className={styles.summary}>
          <span className={styles.totalLabel}>Total</span>
          <span className={`mono ${styles.totalValue}`}>{total.toLocaleString()}</span>
          <span className={styles.totalLabel}>transactions</span>
        </div>
      ) : null}
```

with:

```tsx
      <div className={styles.summaryRow}>
        {typeof total === "number" ? (
          <div className={styles.summary}>
            <span className={styles.totalLabel}>Total</span>
            <span className={`mono ${styles.totalValue}`}>{total.toLocaleString()}</span>
            <span className={styles.totalLabel}>transactions</span>
          </div>
        ) : <span />}
        <DownloadCsvButton address={address} {...(typeof total === "number" ? { txCount: total } : {})} />
      </div>
```

- [ ] **Step 3: Add the summary-row layout**

In `src/app/components/address/TransactionsTab.module.css`, add at the end:

```css
.summaryRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.summaryRow .summary {
  margin-bottom: 0;
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/address/TransactionsTab.tsx src/app/components/address/TransactionsTab.module.css
git commit -m "feat(app): show Download CSV button on the transactions tab"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS, including the new `transactions-csv.test.ts`.

- [ ] **Step 2: Typecheck, lint, build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all succeed.

- [ ] **Step 3: End-to-end download check with Playwright**

Start the dev server, then drive the button and inspect the downloaded file. Run:

```bash
(npm run dev >/tmp/vite.log 2>&1 &) ; for i in $(seq 1 30); do curl -s -o /dev/null "http://localhost:5173/" && break; sleep 1; done
cat > .shot.mjs <<'JS'
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:5173/address/z1qzqajuhyfqkk4fy2z3ls0x29quyetkvqfd6n4x#transactions');
await p.getByRole('button', { name: /download transactions as csv/i }).waitFor({ timeout: 15000 });
const [ download ] = await Promise.all([
  p.waitForEvent('download', { timeout: 30000 }),
  p.getByRole('button', { name: /download transactions as csv/i }).click(),
]);
const path = await download.path();
const fs = await import('node:fs');
const text = fs.readFileSync(path, 'utf8');
const lines = text.trim().split('\r\n');
console.log('suggested filename:', download.suggestedFilename());
console.log('header:', lines[0]);
console.log('data rows:', lines.length - 1);
console.log('first data row:', lines[1]);
await b.close();
JS
node .shot.mjs ; rm -f .shot.mjs
pkill -f vite 2>/dev/null; pkill -f workerd 2>/dev/null
```

Expected: a `download` event fires; `suggestedFilename` is `nomscan-z1qzqajuhyf-transactions-<date>.csv`; the header line lists all 14 quoted columns; there is at least one data row whose fields are quoted. (If the indexer is unreachable the data rows may be 0 with just a header — confirm `.dev.vars` has a valid `NOM_INDEXER_JWT_SECRET`.)

- [ ] **Step 4: Confirm clean tree**

Run: `git status`
Expected: clean working tree (Tasks 1–4 committed).

---

## Self-Review notes (author)

- **Spec coverage:** all-transactions paginated export with 10k cap (Task 1 loop) ✓; both formatted (`amount` via `formatAmount` group:false) + raw (`amount_raw`) columns (Task 1) ✓; 14-column order incl. `direction` (Task 1 + test) ✓; CSV-injection-safe escaping via `csvCell` (Task 1 + test) ✓; `text/csv` + `Content-Disposition` headers (Task 1) ✓; Worker endpoint distinct route (Task 2) ✓; Download button with loading/error + cap-confirm + Blob save (Task 3) ✓; placement in Transactions tab header (Task 4) ✓; tests for aggregation/cap/escaping/direction/errors (Task 1) ✓.
- **Spec deviation (intentional):** the spec's `rawToPlainDecimal` helper was dropped in favor of reusing `formatAmount(raw, decimals, { group: false })` (already BigInt-safe, no separators) — DRY. Spec updated to match.
- **Type consistency:** route export `getAddressTransactionsCsv`, helper `csvCell`, constants `MAX_PAGES`/`MAX_ROWS`/`PAGE_SIZE`, component `DownloadCsvButton` with props `{ address, txCount? }`, CSS classes `summaryRow`/`summary` are used identically across tasks. `getToken`, `getDirection`, `formatAmount`, `isAddress`, `err`, `errorFromThrown` verified against their real signatures.
- **Headers note:** API responses bypass `withSecurityHeaders` (HTML-only), so the route sets `Content-Type`, `Content-Disposition`, and `X-Content-Type-Options` itself.
