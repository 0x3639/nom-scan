# Recent Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/txs` "Latest Transactions" page that lists the newest network-wide account-blocks with user-controlled paging and a 10/25/50/100 page-size dropdown (default 10).

**Architecture:** A new Worker route `/api/transactions` proxies the indexer's global `/api/v1/account_blocks` collection (default `sort=desc`), passing `{data, pagination}` through unchanged. A new TanStack Query hook feeds a new `RecentTxPage` that reuses the existing `TxTable`/`TxList`/`Pagination` components plus a new `PageSizeSelect`. Entry points: a top-nav "Transactions" link and a linked "Transactions" word in the home tagline.

**Tech Stack:** React + TypeScript + Vite SPA, TanStack Query, React Router (lazy routes), Cloudflare Worker proxy, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-08-recent-transactions-design.md`

**Branch:** `feat/recent-transactions` (already created and checked out).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/worker/routes/transactions.ts` (create) | Worker route: clamp params, proxy `/api/v1/account_blocks`, return `{data,pagination}`. |
| `src/worker/routes/transactions.test.ts` (create) | Unit tests for clamping + proxy/passthrough behavior. |
| `src/worker/index.ts` (modify) | Register `.get("/api/transactions", getTransactions)`. |
| `src/app/api/queries.ts` (modify) | `useRecentTransactions` + `usePrefetchNextRecentTransactions` hooks. |
| `src/app/components/PageSizeSelect.tsx` (create) | Themed `<select>` for 10/25/50/100 per page. |
| `src/app/components/PageSizeSelect.module.css` (create) | Styles for the select. |
| `src/app/pages/RecentTxPage.tsx` (create) | The `/txs` page: state, toolbar, table/list, pagination, states. |
| `src/app/pages/RecentTxPage.module.css` (create) | Page layout styles. |
| `src/app/router.tsx` (modify) | Lazy import + `/txs` route. |
| `src/app/layout/TopNav.tsx` (modify) | "Transactions" nav link. |
| `src/app/layout/TopNav.module.css` (modify) | `.navLink` style. |
| `src/app/pages/Home.tsx` (modify) | Link "Transactions" word in tagline to `/txs`. |
| `src/app/pages/Home.module.css` (modify) | `.taglineLink` style. |

---

## Task 1: Worker route `/api/transactions`

**Files:**
- Create: `src/worker/routes/transactions.ts`
- Test: `src/worker/routes/transactions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/worker/routes/transactions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";

vi.mock("../upstream", () => ({ nomIndexerFetch: vi.fn() }));
import { nomIndexerFetch } from "../upstream";
// withCache should just run the producer in tests (no Cache API in node).
vi.mock("../cache", () => ({
  withCache: (_req: Request, _ttl: number, fn: () => Promise<Response>) => fn(),
}));
import { getTransactions, clampAllowedPageSize, clampPage } from "./transactions";

const env = {} as Env;
const ctx = {} as ExecutionContext;

function req(qs: string): Request {
  return new Request(`https://x/api/transactions${qs}`);
}

describe("clampAllowedPageSize", () => {
  it("accepts the allowed sizes", () => {
    expect(clampAllowedPageSize("10")).toBe(10);
    expect(clampAllowedPageSize("25")).toBe(25);
    expect(clampAllowedPageSize("50")).toBe(50);
    expect(clampAllowedPageSize("100")).toBe(100);
  });
  it("falls back to 10 for disallowed or garbage values", () => {
    expect(clampAllowedPageSize("7")).toBe(10);
    expect(clampAllowedPageSize("33")).toBe(10);
    expect(clampAllowedPageSize("200")).toBe(10);
    expect(clampAllowedPageSize(null)).toBe(10);
    expect(clampAllowedPageSize("abc")).toBe(10);
  });
});

describe("clampPage", () => {
  it("defaults to 1 and rejects <1 / garbage", () => {
    expect(clampPage(null)).toBe(1);
    expect(clampPage("0")).toBe(1);
    expect(clampPage("-3")).toBe(1);
    expect(clampPage("abc")).toBe(1);
    expect(clampPage("4")).toBe(4);
  });
});

describe("getTransactions", () => {
  beforeEach(() => vi.mocked(nomIndexerFetch).mockReset());

  it("defaults to page=1, page_size=10, sort=desc and passes {data,pagination} through", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue({
      data: [{ hash: "a" }],
      pagination: { page: 1, page_size: 10, total: 1 },
    });
    const res = await getTransactions(req(""), env, ctx, {});
    expect(vi.mocked(nomIndexerFetch).mock.calls[0][1]).toBe(
      "/api/v1/account_blocks?page=1&page_size=10&sort=desc",
    );
    const body = (await res.json()) as { ok: boolean; data: unknown; pagination: unknown };
    expect(body).toMatchObject({
      ok: true,
      data: [{ hash: "a" }],
      pagination: { total: 1 },
    });
  });

  it("forwards explicit page/sort and clamps a disallowed page_size to 10", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue({ data: [], pagination: { page: 2, page_size: 10 } });
    await getTransactions(req("?page=2&page_size=33&sort=asc"), env, ctx, {});
    expect(vi.mocked(nomIndexerFetch).mock.calls[0][1]).toBe(
      "/api/v1/account_blocks?page=2&page_size=10&sort=asc",
    );
  });

  it("tolerates a bare-array upstream and synthesizes pagination", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue([{ hash: "b" }]);
    const res = await getTransactions(req("?page_size=25"), env, ctx, {});
    const body = (await res.json()) as { ok: boolean; data: unknown; pagination: unknown };
    expect(body).toMatchObject({
      ok: true,
      data: [{ hash: "b" }],
      pagination: { page: 1, page_size: 25 },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:worker -- transactions`
Expected: FAIL — cannot resolve `./transactions` (module/exports not defined yet).

- [ ] **Step 3: Write the route implementation**

Create `src/worker/routes/transactions.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:worker -- transactions`
Expected: PASS — all `clampAllowedPageSize`, `clampPage`, and `getTransactions` cases green.

- [ ] **Step 5: Commit**

```bash
git add src/worker/routes/transactions.ts src/worker/routes/transactions.test.ts
git commit -m "feat(worker): add /api/transactions route proxying account_blocks list"
```

---

## Task 2: Register the route

**Files:**
- Modify: `src/worker/index.ts` (imports block + router chain)

- [ ] **Step 1: Add the import**

In `src/worker/index.ts`, after the line `import { getMomentum } from "./routes/momentum";` add:

```ts
import { getTransactions } from "./routes/transactions";
```

- [ ] **Step 2: Register the route**

In the `new ApiRouter()` chain, add the `/api/transactions` line directly after the `.get("/api/search", getSearch)` line:

```ts
  .get("/api/search", getSearch)
  .get("/api/transactions", getTransactions)
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/worker/index.ts
git commit -m "feat(worker): register /api/transactions route"
```

---

## Task 3: Client query hooks

**Files:**
- Modify: `src/app/api/queries.ts` (add hooks near `usePrefetchNextTransactions`)

- [ ] **Step 1: Add the hooks**

In `src/app/api/queries.ts`, immediately after the `usePrefetchNextTransactions` function, add:

```ts
function recentTxPath(page: number, pageSize: number, sort: "asc" | "desc"): string {
  return `/api/transactions?page=${page}&page_size=${pageSize}&sort=${sort}`;
}

/**
 * Network-wide latest account-blocks for the /txs page. Returns the full
 * NomScanResult so the page can read both `.data` (rows) and `.pagination`.
 */
export function useRecentTransactions(params: TxListParams) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const sort = params.sort ?? "desc";
  return useQuery({
    queryKey: ["transactions", page, pageSize, sort],
    queryFn: () => nomscanFetch<TxRow[]>(recentTxPath(page, pageSize, sort)),
    staleTime: STALE.address,
    placeholderData: keepPreviousData,
  });
}

/** Warm page N+1 of the latest-transactions list in the background. */
export function usePrefetchNextRecentTransactions(params: {
  page: number;
  pageSize: number;
  sort: "asc" | "desc";
  hasNext: boolean;
}) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!params.hasNext) return;
    const next = params.page + 1;
    void qc.prefetchQuery({
      queryKey: ["transactions", next, params.pageSize, params.sort],
      queryFn: () => nomscanFetch<TxRow[]>(recentTxPath(next, params.pageSize, params.sort)),
      staleTime: STALE.address,
    });
  }, [qc, params.page, params.pageSize, params.sort, params.hasNext]);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/queries.ts
git commit -m "feat(app): add useRecentTransactions query hooks"
```

---

## Task 4: PageSizeSelect component

**Files:**
- Create: `src/app/components/PageSizeSelect.tsx`
- Create: `src/app/components/PageSizeSelect.module.css`

- [ ] **Step 1: Create the component**

Create `src/app/components/PageSizeSelect.tsx`:

```tsx
import styles from "./PageSizeSelect.module.css";

const OPTIONS = [10, 25, 50, 100];

interface Props {
  value: number;
  onChange: (next: number) => void;
}

export function PageSizeSelect({ value, onChange }: Props) {
  return (
    <label className={styles.wrap}>
      <span className={styles.label}>Show</span>
      <select
        className={`${styles.select} mono`}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Transactions per page"
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <span className={styles.label}>per page</span>
    </label>
  );
}
```

- [ ] **Step 2: Create the styles**

Create `src/app/components/PageSizeSelect.module.css`:

```css
.wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.label {
  color: var(--color-subtle);
  font-size: 12px;
}

.select {
  appearance: none;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 13px;
  padding: 6px 26px 6px 10px;
  cursor: pointer;
  /* Chevron drawn as an inline SVG background so we don't ship an icon asset. */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a8a8a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  transition: border-color 120ms, background-color 120ms;
}
.select:hover {
  border-color: var(--color-primary);
}
.select:focus-visible {
  outline: none;
  border-color: var(--color-primary);
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/PageSizeSelect.tsx src/app/components/PageSizeSelect.module.css
git commit -m "feat(app): add PageSizeSelect dropdown component"
```

---

## Task 5: RecentTxPage

**Files:**
- Create: `src/app/pages/RecentTxPage.tsx`
- Create: `src/app/pages/RecentTxPage.module.css`

- [ ] **Step 1: Create the page**

Create `src/app/pages/RecentTxPage.tsx`:

```tsx
import { useState } from "react";
import { useRecentTransactions, usePrefetchNextRecentTransactions } from "../api/queries";
import { Pagination } from "../components/Pagination";
import { PageSizeSelect } from "../components/PageSizeSelect";
import { TxTable } from "../components/tx/TxTable";
import { TxList } from "../components/tx/TxList";
import { SkeletonRows } from "../components/state/Skeleton";
import { EmptyState } from "../components/state/EmptyState";
import { ErrorState } from "../components/state/ErrorState";
import styles from "./RecentTxPage.module.css";

export function RecentTxPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const q = useRecentTransactions({ page, pageSize, sort: "desc" });

  const rows = q.data?.data ?? [];
  const total = q.data?.pagination?.total;
  const totalPages = typeof total === "number" ? Math.max(1, Math.ceil(total / pageSize)) : undefined;
  const hasNext = totalPages != null ? page < totalPages : rows.length === pageSize;
  const hasPrev = page > 1;
  const isStale = q.isPlaceholderData;

  usePrefetchNextRecentTransactions({ page, pageSize, sort: "desc", hasNext });

  function changePageSize(next: number) {
    setPageSize(next);
    setPage(1);
  }

  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>Latest Transactions</h1>
        <PageSizeSelect value={pageSize} onChange={changePageSize} />
      </header>

      {q.isLoading ? (
        <SkeletonRows rows={6} height={28} />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : rows.length === 0 ? (
        <div>
          <EmptyState
            title={page === 1 ? "No transactions" : "No more transactions"}
            message={
              page === 1
                ? "The indexer has no account-blocks yet."
                : "You've reached the end of the list."
            }
          />
          {page > 1 ? <Pagination page={page} hasNext={false} hasPrev onChange={setPage} /> : null}
        </div>
      ) : (
        <div>
          {typeof total === "number" ? (
            <div className={styles.summary}>
              <span className={styles.totalLabel}>Total</span>
              <span className={`mono ${styles.totalValue}`}>{total.toLocaleString()}</span>
              <span className={styles.totalLabel}>transactions</span>
            </div>
          ) : null}
          <div aria-busy={isStale} style={{ opacity: isStale ? 0.55 : 1, transition: "opacity 120ms" }}>
            <div className={styles.tableWrap}>
              <TxTable rows={rows} />
            </div>
            <div className={styles.listWrap}>
              <TxList rows={rows} />
            </div>
          </div>
          <Pagination
            page={page}
            {...(totalPages !== undefined ? { totalPages } : { hasNext, hasPrev })}
            onChange={setPage}
          />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Create the styles**

Create `src/app/pages/RecentTxPage.module.css`:

```css
.wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: var(--tracking);
  color: var(--color-text);
}

.summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
  padding: 0 2px;
}

.totalLabel {
  color: var(--color-subtle);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.totalValue {
  color: var(--color-text);
  font-weight: 700;
  font-size: 15px;
}

.tableWrap {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.listWrap {
  display: none;
}

@media (max-width: 720px) {
  .tableWrap { display: none; }
  .listWrap { display: block; }
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/RecentTxPage.tsx src/app/pages/RecentTxPage.module.css
git commit -m "feat(app): add RecentTxPage (/txs latest transactions view)"
```

---

## Task 6: Wire routing + nav + home tagline links

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/app/layout/TopNav.tsx`
- Modify: `src/app/layout/TopNav.module.css`
- Modify: `src/app/pages/Home.tsx`
- Modify: `src/app/pages/Home.module.css`

- [ ] **Step 1: Add the lazy import + route**

In `src/app/router.tsx`, after the `const TxPage = lazy(...)` line add:

```ts
const RecentTxPage = lazy(() => import("./pages/RecentTxPage").then((m) => ({ default: m.RecentTxPage })));
```

Then, in the children array, add the route after the `{ path: "/tx/:hash", element: <TxPage /> }` entry:

```tsx
          { path: "/txs", element: <RecentTxPage /> },
```

- [ ] **Step 2: Add the top-nav link**

In `src/app/layout/TopNav.tsx`, change the `.right` block from:

```tsx
        <div className={styles.right}>
          {isShareable && <ShareButton />}
          <Link to="/login" className={styles.account}>Sign in</Link>
        </div>
```

to:

```tsx
        <div className={styles.right}>
          <Link to="/txs" className={styles.navLink}>Transactions</Link>
          {isShareable && <ShareButton />}
          <Link to="/login" className={styles.account}>Sign in</Link>
        </div>
```

- [ ] **Step 3: Add the `.navLink` style**

In `src/app/layout/TopNav.module.css`, add directly before the `.account {` rule:

```css
.navLink {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
  letter-spacing: var(--tracking);
  transition: color 120ms;
}
.navLink:hover {
  color: var(--color-text);
}

@media (max-width: 640px) {
  .navLink { display: none; }
}
```

- [ ] **Step 4: Link the home tagline word**

In `src/app/pages/Home.tsx`, add the router import at the top:

```tsx
import { Link } from "react-router-dom";
```

Then change the tagline line from:

```tsx
      <p className={styles.tagline}>Zenon Explorer · Portfolio · Transactions</p>
```

to:

```tsx
      <p className={styles.tagline}>
        Zenon Explorer · Portfolio ·{" "}
        <Link to="/txs" className={styles.taglineLink}>Transactions</Link>
      </p>
```

- [ ] **Step 5: Add the `.taglineLink` style**

In `src/app/pages/Home.module.css`, add at the end of the file:

```css
.taglineLink {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--color-border);
  text-underline-offset: 3px;
  transition: color 120ms, text-decoration-color 120ms;
}
.taglineLink:hover {
  color: var(--color-text);
  text-decoration-color: var(--color-primary);
}
```

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS for both.

- [ ] **Step 7: Commit**

```bash
git add src/app/router.tsx src/app/layout/TopNav.tsx src/app/layout/TopNav.module.css src/app/pages/Home.tsx src/app/pages/Home.module.css
git commit -m "feat(app): route /txs and link it from nav + home tagline"
```

---

## Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS, including the new `transactions.test.ts`.

- [ ] **Step 2: Typecheck, lint, production build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all succeed; build emits client + worker bundles.

- [ ] **Step 3: Visual smoke test with Playwright**

Start the dev server in the background, then capture the page. Run:

```bash
(npm run dev >/tmp/vite.log 2>&1 &) ; for i in $(seq 1 30); do curl -s -o /dev/null "http://localhost:5173/" && break; sleep 1; done
cat > .shot.mjs <<'JS'
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:5173/txs');
await p.waitForSelector('table, [class*="empty"], [class*="error"]', { timeout: 15000 });
await p.screenshot({ path: '/tmp/txs.png', fullPage: false });
console.log('per-page select present:', await p.locator('select[aria-label="Transactions per page"]').count());
await b.close();
JS
node .shot.mjs ; rm -f .shot.mjs
pkill -f vite 2>/dev/null; pkill -f workerd 2>/dev/null
```

Expected: `/tmp/txs.png` shows the "Latest Transactions" header, the "Show [10] per page" dropdown, a populated `TxTable`, and pagination. `per-page select present: 1`. (Read `/tmp/txs.png` to confirm.) If the table is empty, confirm `.dev.vars` has a valid `NOM_INDEXER_JWT_SECRET` so the Worker can reach the indexer.

- [ ] **Step 4: Confirm default page size is 10**

In `/tmp/txs.png` (or by interacting in a browser), confirm the table shows at most 10 rows on first load and the dropdown reads `10`. Changing the dropdown to 25/50/100 reloads with that many rows and resets to page 1.

- [ ] **Step 5: Final no-op commit guard**

Run: `git status`
Expected: clean working tree (all work already committed in Tasks 1–6). If anything is uncommitted, review and commit it.

---

## Self-Review notes (author)

- **Spec coverage:** columns (reuse `TxTable`, Task 5) ✓; pagination + 10/25/50/100 dropdown default 10 (Tasks 4–5) ✓; `/txs` route (Task 6) ✓; worker `/api/transactions` proxy + clamps (Task 1) ✓; nav link + home tagline link (Task 6) ✓; all-blocks newest-first (Task 1 `sort=desc`, no filtering) ✓; tests (Task 1) ✓.
- **Type consistency:** hook names `useRecentTransactions` / `usePrefetchNextRecentTransactions`, route export `getTransactions`, helpers `clampAllowedPageSize` / `clampPage`, component `PageSizeSelect`, page `RecentTxPage` are used identically everywhere they appear.
- **Reused props verified against source:** `TxTable`/`TxList` accept `{ rows, viewedAddress? }` (viewedAddress omitted → "PAIR"); `SkeletonRows {rows,height}`; `EmptyState {title,message}`; `ErrorState {error,retry}`; `Pagination {page,totalPages?|hasNext?/hasPrev?,onChange}`; `ok(data, pagination)` and `nomscanFetch<TxRow[]>` returns the full `{ok,data,pagination}` result.
