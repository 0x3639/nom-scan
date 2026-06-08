# Recent Transactions — Design

**Date:** 2026-06-08
**Branch:** `feat/recent-transactions`
**Status:** Approved (design)

## Goal

Add a public "Latest Transactions" view that lists the most recent
account-blocks (transactions) network-wide, with user-controlled paging and
page size. This is the standard block-explorer "latest txns" surface, backed
by the indexer's global `/api/v1/account_blocks` collection endpoint.

## Requirements

- Show columns: **TX Hash, From, To, Amount, Timestamp** (plus the extra
  columns the existing `TxTable` already renders — see Decisions).
- **Pagination** with a **page-size dropdown**: 10, 25, 50, 100. **Default 10.**
- Newest first.

## Decisions (resolved during brainstorming)

1. **Location:** A dedicated route at **`/txs`**, reachable from a
   **"Transactions"** text link in the top nav (right cluster, before "Sign in").
2. **Columns:** **Reuse the existing `TxTable` / `TxList` as-is** rather than
   building a lean 5-column table. The existing table already renders Hash,
   Type/Method, Age, From, To, Dir, Amount, Token, Momentum — a superset of the
   requested columns, already styled and tested. "Timestamp" is satisfied by the
   existing relative **Age** column (exact time available where the component
   already exposes it).
3. **Send/receive:** **Show all account-blocks as the indexer returns them**,
   newest first. The list endpoint has no `block_type` filter, so a
   "sends only" view would require an indexer change; deferred. A send and its
   matching receive may therefore appear as two rows.

## Architecture & Data Flow

```
RecentTxPage (/txs)
  ├─ state: page (default 1), pageSize (default 10), sort = "desc"
  ├─ PageSizeSelect (10/25/50/100) ── onChange → setPageSize + reset page=1
  ├─ useRecentTransactions({page, pageSize, sort})   [TanStack Query]
  │     └─ GET /api/transactions?page&page_size&sort   [NoM Scan Worker API]
  │           └─ GET /api/v1/account_blocks?page&page_size&sort   [nom-indexer-go]
  ├─ TxTable (desktop) / TxList (mobile)   ── rows, no viewedAddress
  └─ Pagination  ── page / totalPages|hasNext
```

### Worker API — `GET /api/transactions`

New route `src/worker/routes/transactions.ts`, registered in
`src/worker/index.ts` as `.get("/api/transactions", getTransactions)`.

- Query params: `page` (default 1, clamp ≥ 1), `page_size` (default 10),
  `sort` (`asc` | `desc`, default `desc`).
- **page_size clamping:** only the allowed set **{10, 25, 50, 100}** is honored;
  any other value falls back to the default **10**. (This is stricter than the
  generic 1–200 clamp used elsewhere, matching the dropdown's fixed options.)
- Proxies `/api/v1/account_blocks?page=&page_size=&sort=` via `nomIndexerFetch`.
- Returns `{ data, pagination }` passthrough using the same `ok(entries,
  pagination)` shape as `routes/address.ts` (extract `data`/`pagination`,
  tolerate a bare array). Short cache TTL for page 1 desc (newest, changes
  often), mirroring the address-transactions caching pattern.
- The upstream `AccountBlock` fields (`hash`, `address`, `to_address`,
  `amount`, `token_standard`, `momentum_timestamp`, `momentum_height`,
  `method`, `block_type`) map directly onto the shared `TxRow` type — no custom
  normalization needed.

### Client query — `useRecentTransactions`

New hook in `src/app/api/queries.ts`, mirroring `useAddressTransactions`:

- `queryKey: ["transactions", page, pageSize, sort]`
- `placeholderData: keepPreviousData` (smooth paging, no flicker)
- Optional `usePrefetchNextTransactions`-style prefetch of page N+1.

### Page — `RecentTxPage` (`src/app/pages/RecentTxPage.tsx`)

- Modeled on `address/TransactionsTab.tsx`: loading skeleton, error state,
  empty/"no more" state, stale-while-revalidate opacity, total count summary.
- Renders `TxTable` + `TxList` **without** `viewedAddress` → the Dir column
  shows the neutral "PAIR" badge (already supported).
- A toolbar row above the table holds the page-size dropdown
  (right-aligned: "Show [10 ▾] per page").

### PageSizeSelect — `src/app/components/PageSizeSelect.tsx`

Small reusable control: a themed native `<select>` with options 10/25/50/100.
Props: `value: number`, `onChange: (n: number) => void`. Used by `RecentTxPage`;
generic enough to reuse on the address transactions tab later (not done now).

### Routing & nav

- `src/app/router.tsx`: add `{ path: "/txs", element: <RecentTxPage /> }`.
- `src/app/layout/TopNav.tsx`: add a `<Link to="/txs">Transactions</Link>` in
  the right cluster before "Sign in", styled as a subtle text link (not the
  green primary button).
- `src/app/pages/Home.tsx`: in the tagline
  "Zenon Explorer · Portfolio · Transactions", make the **"Transactions"** word
  a `<Link to="/txs">`. The other words stay plain text for now (Portfolio has
  no global landing page). The link should read as part of the tagline (inherit
  its muted color, underline or brighten on hover) rather than look like a button.

## Pagination total handling

`/api/v1/account_blocks` pagination may or may not include `total`. Reuse the
existing dual handling: if `pagination.total` is present, compute `totalPages`
and enable First/Last + jump-to-page; otherwise fall back to the
`hasNext = rows.length === pageSize` heuristic. (Same logic as
`TransactionsTab`.)

## Testing

- `src/worker/routes/transactions.test.ts` (Vitest, following
  `routes/search.test.ts`):
  - page_size clamps to the allowed set (e.g. `7 → 10`, `33 → 10`, `100 → 100`).
  - default `sort=desc`; explicit `asc` honored.
  - upstream `{data, pagination}` passed through; bare-array upstream tolerated.
  - `page` clamps to ≥ 1.

## Out of Scope (YAGNI)

- Send/receive pair stitching (deferred; shows all blocks).
- New/custom columns beyond the existing `TxTable`.
- Live auto-refresh / polling of the latest page.
- Reusing `PageSizeSelect` on the address transactions tab (possible later).
