# Address Transactions CSV Download — Design

**Date:** 2026-06-08
**Branch:** `feat/tx-csv-download`
**Status:** Approved (design)

## Goal

Add a Blockscan-style "Download CSV" button to an address's Transactions tab
that exports **all** of that address's transactions (account-blocks) as a CSV
file, with both human-readable and raw amount columns.

## Decisions (resolved during brainstorming)

1. **Scope:** Export **all transactions** for the address (not just the current
   page), assembled by the **Worker** (approach A).
2. **Amounts:** Include **both** a formatted decimal amount + token symbol AND
   the raw integer amount + token standard.
3. **Approach:** A dedicated Worker CSV endpoint that paginates the indexer,
   enriches token metadata, and returns a ready-to-save CSV. The frontend just
   triggers the download. (Approaches B "client-side assembly" and C "hybrid"
   were rejected for more browser round-trips and duplicated CSV logic.)
4. **Cap:** Export at most **10,000 rows** (50 pages × 200) — the newest first.
   The 60 req/min indexer budget is shared across the `nomscan` subject, so the
   cap is intentionally bounded and tunable. The frontend warns before download
   if the address's known `tx_count` exceeds the cap.

## Architecture & Data Flow

```
TransactionsTab header
  └─ DownloadCsvButton(address, txCount)
        ├─ if txCount > 10000 → confirm "newest 10,000 only"
        ├─ fetch GET /api/address/:address/transactions.csv      [NoM Scan Worker]
        │     └─ loop GET /api/v1/accounts/{address}/transactions  [nom-indexer-go]
        │            ?page=N&page_size=200&sort=desc   (until empty or 50 pages)
        │     └─ enrich unique token_standards via getToken()      [tokens service]
        │     └─ build CSV (injection-safe) → text/csv + Content-Disposition
        └─ on success: save Blob as nomscan-<addr>-transactions-<date>.csv
```

### Worker endpoint — `GET /api/address/:address/transactions.csv`

New route `src/worker/routes/transactions-csv.ts`, registered in
`src/worker/index.ts` as
`.get("/api/address/:address/transactions.csv", getAddressTransactionsCsv)`.
`URLPattern` matches this distinctly from the existing
`/api/address/:address/transactions` route (last segment `transactions.csv` ≠
`transactions`).

Behavior:
- Validate `address` with `isAddress`; 400 (`bad_request`) if invalid.
- Paginate `/api/v1/accounts/{address}/transactions?page=N&page_size=200&sort=desc`
  starting at page 1, accumulating rows, stopping when a page returns fewer than
  200 rows OR the row cap (10,000) is reached OR 50 pages have been fetched.
  Tolerate a bare-array upstream (same as `routes/address.ts`).
- Collect the set of unique `token_standard` values across all rows and resolve
  each once via `getToken(env, standard)` (24h-cached) into a
  `Map<standard, TokenMeta>`. Rows whose token can't be resolved fall back to
  `decimals = 8`, `symbol = ""`.
- Build the CSV (see columns + escaping below).
- Return `200` with:
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="nomscan-<short>-transactions-<YYYY-MM-DD>.csv"`
    where `<short>` is the first 12 chars of the address and the date is the
    Worker's `new Date().toISOString().slice(0,10)`.
  - `X-Content-Type-Options: nosniff` (the global security headers already wrap
    responses; the CSV route relies on them).
- On any upstream failure (including a 429 mid-loop), return the standard JSON
  error via `errorFromThrown` (NOT a partial CSV). The frontend detects the
  non-CSV / non-OK response and shows an error.
- No Cache API caching for v1 (each download is fresh).

### CSV format

**Columns (in order):**

| Column | Source | Notes |
| --- | --- | --- |
| `tx_hash` | `row.hash` | |
| `direction` | `getDirection(row, address)` | IN / OUT / SELF / PAIR relative to the viewed address |
| `block_type` | `row.block_type` | raw integer (e.g. 2) |
| `method` | `row.method` | empty string if null |
| `timestamp_utc` | `momentum_timestamp` (fallback `timestamp`) | ISO 8601, `new Date(sec*1000).toISOString()`; empty if missing |
| `timestamp_unix` | same | integer seconds; empty if missing |
| `from_address` | `row.address` | |
| `to_address` | `row.to_address` | empty if null |
| `amount` | `rawToPlainDecimal(row.amount, decimals)` | full-precision decimal **string math, no thousands separators**, e.g. `12.5`; empty if no amount |
| `token_symbol` | `TokenMeta.symbol` | empty if unknown |
| `amount_raw` | `row.amount` | raw integer string, passed through; empty if null |
| `token_standard` | `row.token_standard` | empty if null |
| `momentum_height` | `row.momentum_height` | |
| `momentum_hash` | `row.momentum_hash` | |

- First line is the header row with these exact column names.
- Line terminator `\r\n` (RFC 4180).

**`rawToPlainDecimal(raw, decimals)`** — a new pure helper in
`src/shared/format/amount.ts` (unit-tested). Converts a raw integer **string**
to a plain decimal **string** using string math only (NEVER `Number()` — amounts
can exceed `Number.MAX_SAFE_INTEGER`): left-pad to `decimals+1` digits, insert
the decimal point, strip trailing zeros and a trailing `.`. Examples:
`("1250000000", 8) → "12.5"`, `("5", 8) → "0.00000005"`, `("100000000", 8) → "1"`,
`("0", 8) → "0"`.

**Escaping (CSV-injection-safe), in a `csvCell(value)` helper:**
- Convert null/undefined to `""`.
- If the cell starts with `=`, `+`, `-`, or `@`, prefix it with a single
  quote `'` to neutralize spreadsheet formula injection.
- Always wrap the cell in double quotes and double any internal `"`.
  (Wrapping everything keeps commas/newlines safe and the output uniform.)

### Frontend — `DownloadCsvButton`

New component `src/app/components/address/DownloadCsvButton.tsx` (+ CSS module),
rendered in the `TransactionsTab` header beside the "TOTAL N transactions"
summary.

Props: `address: string`, `txCount?: number`.

Behavior:
- A button labeled "Download CSV" with a `Download` (lucide) icon.
- On click:
  - If `txCount` is known and `> 10000`, `window.confirm` that only the newest
    10,000 transactions will be exported; abort if declined.
  - Set state to `loading` ("Preparing…", button disabled, spinner).
  - `fetch("/api/address/<address>/transactions.csv")`. On `res.ok` with a CSV
    content-type, read `blob()`, create an object URL, and trigger a download via
    a transient `<a download>` element. Filename: prefer the server's
    `Content-Disposition`; otherwise `nomscan-<address.slice(0,12)>-transactions-<YYYY-MM-DD>.csv`.
    Revoke the object URL afterward.
  - On non-OK / error: set an inline error state ("Couldn't generate export —
    try again") for a few seconds; re-enable the button.
- Accessibility: button has an `aria-label`; the loading text uses
  `aria-live="polite"`.

`TransactionsTab` passes the `tx_count` it already shows (from
`useAddressSummary`) — or, since the tab currently reads `total` from the
transactions pagination, pass that `total` as `txCount`.

### Testing

- `src/shared/format/amount.test.ts` (extend): `rawToPlainDecimal` cases —
  whole numbers, fractional, leading zeros, `0`, large values beyond
  `Number.MAX_SAFE_INTEGER`, `decimals = 0`.
- `src/worker/routes/transactions-csv.test.ts` (new, follows
  `routes/search.test.ts` style, mocking `../upstream` and `../services/tokens`):
  - Aggregates multiple pages (e.g. a 200-row page then a 30-row page → 230 data
    rows + 1 header) and stops at the short page.
  - Enforces the 10,000-row / 50-page cap.
  - Header row matches the exact column list.
  - `direction` computed correctly for OUT/IN/SELF/PAIR rows.
  - `amount` formatted via decimals from token metadata; `amount_raw` passed
    through; unknown token → `decimals 8`, empty symbol.
  - CSV-injection-safe escaping: a `method` of `=cmd` becomes `"'=cmd"`; values
    with commas/quotes are wrapped/escaped.
  - 400 for an invalid address; upstream error → JSON error response (not CSV).

## Out of Scope (YAGNI)

- Date-range or block-range filtering.
- Formats other than CSV (JSON, XLSX).
- A download button on the global `/txs` page.
- Streaming responses / async job for >10,000-row addresses (capped instead).
- Cache API caching of generated CSVs.
