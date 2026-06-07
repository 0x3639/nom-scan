# Momentum Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users search a Zenon momentum by height/number from the existing search box and land on a new `/momentum/:height` detail page (hash search deferred until the indexer adds an endpoint).

**Architecture:** Unchanged two-tier model — React app → NoM Scan Worker API → nom-indexer-go (minted JWT). A bare integer is auto-detected as a momentum height. A new Worker route `GET /api/momentum/:height` proxies `/api/v1/momentums/{height}` and derives "previous hash" from the momentum at `height-1`. A new React page mirrors the existing transaction page.

**Tech Stack:** TypeScript, React, React Router, TanStack Query, Cloudflare Worker (URLPattern router), Vitest, CSS modules.

**Reference spec:** `docs/superpowers/specs/2026-06-07-momentum-search-design.md`

**Conventions for every task:**
- Run a single test file with: `npx vitest run <path>`
- Typecheck with: `npm run typecheck`
- Lint with: `npm run lint`
- Commit messages end with the repo's `Co-Authored-By` trailer (see existing history).

---

## File Structure

**Modify:**
- `src/shared/validate/identifier.ts` — add `momentum` query type + helpers
- `src/shared/validate/identifier.test.ts` — momentum detection tests
- `src/shared/api/nomscan.ts` — extend `SearchKind`, add `MomentumDetail`
- `src/worker/index.ts` — register the momentum route
- `src/worker/routes/search.ts` — momentum dispatch in `/api/search`
- `src/worker/routes/search.test.ts` — momentum search tests
- `src/app/api/queries.ts` — `useMomentum` + `useLatestMomentumHeight` hooks
- `src/app/components/SearchInput.tsx` — route momentum queries + placeholder
- `src/app/pages/Search.tsx` — navigate on `kind === "momentum"`
- `src/app/router.tsx` — add `/momentum/:height` route

**Create:**
- `src/worker/routes/momentum.ts` — `GET /api/momentum/:height` handler
- `src/worker/routes/momentum.routes.test.ts` — handler tests
- `src/app/pages/MomentumPage.tsx` — page shell
- `src/app/components/momentum/MomentumHeader.tsx` — title + prev/next nav
- `src/app/components/momentum/MomentumHeader.module.css`
- `src/app/components/momentum/MomentumDetailsTable.tsx` — detail rows + raw data (reuses tx table CSS)

---

## Task 1: Identifier detection — momentum query type

**Files:**
- Modify: `src/shared/validate/identifier.ts`
- Test: `src/shared/validate/identifier.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/shared/validate/identifier.test.ts`:

```ts
import { isMomentumHeight, normalizeMomentum } from "./identifier";

describe("momentum height detection", () => {
  it("classifies a bare positive integer as momentum", () => {
    expect(detectQueryType("13444825")).toBe("momentum");
    expect(detectQueryType("  42 ")).toBe("momentum");
  });

  it("does not treat 0, negatives, or non-digits as momentum", () => {
    expect(detectQueryType("0")).toBe("invalid");
    expect(detectQueryType("-5")).toBe("invalid");
    expect(detectQueryType("1.5")).toBe("invalid");
    expect(detectQueryType("12x")).toBe("invalid");
  });

  it("does not misclassify addresses or 64-hex hashes as momentum", () => {
    expect(detectQueryType("z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp")).toBe("address");
    expect(detectQueryType("a".repeat(64))).toBe("hash");
  });

  it("rejects absurdly long digit strings (>18 digits)", () => {
    expect(isMomentumHeight("1".repeat(19))).toBe(false);
    expect(isMomentumHeight("1".repeat(18))).toBe(true);
  });

  it("normalizeMomentum trims to the canonical digit string", () => {
    expect(normalizeMomentum("  77 ")).toBe("77");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/shared/validate/identifier.test.ts`
Expected: FAIL — `isMomentumHeight`/`normalizeMomentum` not exported; `detectQueryType("13444825")` returns `"invalid"`.

- [ ] **Step 3: Implement the detection**

In `src/shared/validate/identifier.ts`:

Change the `QueryType` union to include `"momentum"`:

```ts
export type QueryType = "address" | "hash" | "momentum" | "ambiguous" | "invalid";
```

Add this constant next to the other regexes (after `HEX64_RE`):

```ts
// A momentum height is a positive integer with no leading zero. Cap the length
// so absurd inputs can't pass (chain height stays well under 18 digits).
const MOMENTUM_RE = /^[1-9]\d{0,17}$/;
```

Add these exported helpers (place after `isHash`):

```ts
export function isMomentumHeight(q: string): boolean {
  return MOMENTUM_RE.test(q.trim());
}

/** Trims to the canonical digit string. */
export function normalizeMomentum(input: string): string {
  return input.trim();
}
```

Update `detectQueryType` to check momentum after hash:

```ts
export function detectQueryType(q: string): QueryType {
  const t = q.trim();
  if (!t) return "invalid";
  const addr = isAddress(t);
  const hash = isHash(t);
  if (addr && hash) return "ambiguous";
  if (addr) return "address";
  if (hash) return "hash";
  if (isMomentumHeight(t)) return "momentum";
  return "invalid";
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/shared/validate/identifier.test.ts`
Expected: PASS (all describe blocks, including the pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/shared/validate/identifier.ts src/shared/validate/identifier.test.ts
git commit -m "feat: detect momentum height in search identifier parsing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Shared types — SearchKind + MomentumDetail

**Files:**
- Modify: `src/shared/api/nomscan.ts`

No dedicated test (types only); verified by `npm run typecheck` in later tasks.

- [ ] **Step 1: Extend `SearchKind`**

In `src/shared/api/nomscan.ts`, change the Search section:

```ts
// ── Search ───────────────────────────────────────────────────────────────────
export type SearchKind = "address" | "tx" | "momentum" | "not_found";
export interface SearchResult {
  kind: SearchKind;
  target?: string;
}
```

- [ ] **Step 2: Add the `MomentumDetail` type**

Add a new section after the Transactions section (after the `txTimestamp` function):

```ts
// ── Momentum ─────────────────────────────────────────────────────────────────
export interface MomentumDetail {
  height: number;
  hash: string;
  /** Unix-seconds timestamp. */
  timestamp: number;
  /** Account-blocks contained in this momentum. */
  tx_count: number;
  producer: string;
  producer_owner?: string;
  producer_name?: string;
  /**
   * Derived by the Worker from the momentum at height-1. Absent at height 1 or
   * if the previous momentum couldn't be fetched. (The indexer's Momentum object
   * does not yet expose previousHash directly.)
   */
  previous_hash?: string;
  // The Worker proxies the upstream momentum object directly; unknown fields are
  // preserved so the Raw data view auto-upgrades when the indexer adds raw node
  // fields (publicKey, signature, changesHash, …).
  [key: string]: unknown;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no usages yet; just confirms the file compiles).

- [ ] **Step 4: Commit**

```bash
git add src/shared/api/nomscan.ts
git commit -m "feat: add MomentumDetail type and momentum SearchKind

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Worker momentum route

**Files:**
- Create: `src/worker/routes/momentum.ts`
- Create: `src/worker/routes/momentum.routes.test.ts`
- Modify: `src/worker/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/worker/routes/momentum.routes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import type { MomentumDetail } from "@shared/api/nomscan";

vi.mock("../upstream", () => ({ nomIndexerFetch: vi.fn() }));
import { nomIndexerFetch } from "../upstream";
import { UpstreamError } from "../errors";
import { getMomentum } from "./momentum";

const env = {} as Env;
const ctx = {} as ExecutionContext;

function req(): Request {
  return new Request("https://x/api/momentum/100");
}

const M = (height: number): MomentumDetail => ({
  height,
  hash: `hash${height}`,
  timestamp: 1700000000 + height,
  tx_count: 3,
  producer: "z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp",
});

beforeEach(() => {
  vi.mocked(nomIndexerFetch).mockReset();
});

describe("getMomentum", () => {
  it("returns 400 for a non-numeric or missing height", async () => {
    expect((await getMomentum(req(), env, ctx, {})).status).toBe(400);
    expect((await getMomentum(req(), env, ctx, { height: "abc" })).status).toBe(400);
    expect((await getMomentum(req(), env, ctx, { height: "0" })).status).toBe(400);
  });

  it("returns the momentum and derives previous_hash from height-1", async () => {
    vi.mocked(nomIndexerFetch).mockImplementation(async (_e, path: string) =>
      path.endsWith("/100") ? M(100) : M(99),
    );
    const res = await getMomentum(req(), env, ctx, { height: "100" });
    const body = (await res.json()) as { data: MomentumDetail };
    expect(body.data.height).toBe(100);
    expect(body.data.previous_hash).toBe("hash99");
  });

  it("omits previous_hash at height 1 without fetching a previous momentum", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue(M(1));
    const res = await getMomentum(req(), env, ctx, { height: "1" });
    const body = (await res.json()) as { data: MomentumDetail };
    expect(body.data.previous_hash).toBeUndefined();
    expect(nomIndexerFetch).toHaveBeenCalledTimes(1);
  });

  it("still returns the momentum if the previous-momentum fetch fails", async () => {
    vi.mocked(nomIndexerFetch).mockImplementation(async (_e, path: string) => {
      if (path.endsWith("/100")) return M(100);
      throw new UpstreamError(404, "nf", null, null);
    });
    const res = await getMomentum(req(), env, ctx, { height: "100" });
    const body = (await res.json()) as { data: MomentumDetail };
    expect(res.status).toBe(200);
    expect(body.data.previous_hash).toBeUndefined();
  });

  it("passes through a 404 when the requested height does not exist", async () => {
    vi.mocked(nomIndexerFetch).mockRejectedValue(new UpstreamError(404, "nf", null, null));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await getMomentum(req(), env, ctx, { height: "999999999" });
    expect(res.status).toBe(404);
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/worker/routes/momentum.routes.test.ts`
Expected: FAIL — cannot import `./momentum` (module does not exist).

- [ ] **Step 3: Implement the route handler**

Create `src/worker/routes/momentum.ts`:

```ts
import type { RouteHandler } from "../router";
import { nomIndexerFetch } from "../upstream";
import { ok, err, errorFromThrown } from "../respond";
import type { MomentumDetail } from "@shared/api/nomscan";

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
```

- [ ] **Step 4: Register the route**

In `src/worker/index.ts`, add the import alongside the others:

```ts
import { getMomentum } from "./routes/momentum";
```

And add the route to the `ApiRouter` chain, after the `/api/tx/:hash` line:

```ts
  .get("/api/momentum/:height", getMomentum)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/worker/routes/momentum.routes.test.ts`
Expected: PASS (all five cases).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/worker/routes/momentum.ts src/worker/routes/momentum.routes.test.ts src/worker/index.ts
git commit -m "feat: add GET /api/momentum/:height worker route with derived previous hash

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Worker search route — momentum dispatch

**Files:**
- Modify: `src/worker/routes/search.ts`
- Test: `src/worker/routes/search.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe("getSearch dispatch", …)` block in `src/worker/routes/search.test.ts`:

```ts
  it("resolves an existing momentum height", async () => {
    vi.mocked(nomIndexerFetch).mockResolvedValue({});
    const res = await getSearch(req("13444825"), env, ctx, {});
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual({ kind: "momentum", target: "13444825" });
  });

  it("returns not_found when the momentum height 404s upstream", async () => {
    vi.mocked(nomIndexerFetch).mockRejectedValue(new UpstreamError(404, "nf", null, null));
    const res = await getSearch(req("999999999"), env, ctx, {});
    const body = (await res.json()) as { data: unknown };
    expect(body.data).toEqual({ kind: "not_found" });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/worker/routes/search.test.ts`
Expected: FAIL — momentum query returns `{ kind: "not_found" }` (currently treated as invalid) and never calls upstream.

- [ ] **Step 3: Implement momentum dispatch**

In `src/worker/routes/search.ts`:

Update the import from the identifier module to include the momentum helper:

```ts
import { detectQueryType, normalizeAddress, normalizeHash, normalizeMomentum } from "@shared/validate/identifier";
```

Add an `existsMomentum` helper next to `existsAccountBlock`:

```ts
async function existsMomentum(env: import("../env").Env, height: string): Promise<boolean> {
  try {
    await nomIndexerFetch(env, `/api/v1/momentums/${encodeURIComponent(height)}`);
    return true;
  } catch (e) {
    if (e instanceof UpstreamError && e.status === 404) return false;
    throw e;
  }
}
```

Add the momentum branch in `getSearch`, after the `kind === "hash"` branch and before `kind === "ambiguous"`:

```ts
    if (kind === "momentum") {
      const height = normalizeMomentum(q);
      const exists = await existsMomentum(env, height);
      return ok<SearchResult>(exists ? { kind: "momentum", target: height } : { kind: "not_found" });
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/worker/routes/search.test.ts`
Expected: PASS (new cases plus all pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/worker/routes/search.ts src/worker/routes/search.test.ts
git commit -m "feat: dispatch momentum-height queries in /api/search

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Frontend query hooks

**Files:**
- Modify: `src/app/api/queries.ts`

No dedicated unit test (hooks are thin wrappers verified through the page and typecheck).

- [ ] **Step 1: Add the import and stale time**

In `src/app/api/queries.ts`, add `MomentumDetail` to the type import block:

```ts
import type {
  AddressSummary,
  BalanceEntry,
  MomentumDetail,
  PriceMap,
  SearchResult,
  TokenMeta,
  TxDetail,
  TxRow,
} from "@shared/api/nomscan";
```

Add a `momentum` entry to the `STALE` object (momentums are immutable once produced, so cache them long):

```ts
const STALE = {
  status: 5_000,
  address: 30_000,
  tx: 60_000,
  token: 5 * 60_000,
  prices: 60_000,
  momentum: 5 * 60_000,
};
```

- [ ] **Step 2: Add the hooks**

Append to `src/app/api/queries.ts`:

```ts
export function useMomentum(height: string) {
  return useQuery({
    queryKey: ["momentum", height],
    queryFn: () =>
      nomscanFetch<MomentumDetail>(`/api/momentum/${encodeURIComponent(height)}`).then((r) => r.data),
    staleTime: STALE.momentum,
    enabled: Boolean(height),
  });
}

/**
 * Latest momentum height from the status endpoint (reused by MomentumBadge's
 * source fields). Returns null until known — used to disable "next" at the tip.
 */
export function useLatestMomentumHeight(): number | null {
  const status = useStatus();
  const d =
    status.data && typeof status.data === "object" ? (status.data as Record<string, unknown>) : null;
  const h = d ? d["latest_height"] ?? d["momentum_height"] ?? d["height"] ?? null : null;
  if (typeof h === "number") return h;
  if (typeof h === "string" && /^\d+$/.test(h)) return Number(h);
  return null;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/queries.ts
git commit -m "feat: add useMomentum and useLatestMomentumHeight hooks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: SearchInput routing + placeholder

**Files:**
- Modify: `src/app/components/SearchInput.tsx`
- Modify: `src/app/layout/TopNav.tsx`

- [ ] **Step 1: Route momentum queries**

In `src/app/components/SearchInput.tsx`:

Update the identifier import:

```ts
import { detectQueryType, normalizeAddress, normalizeHash, normalizeMomentum } from "@shared/validate/identifier";
```

In the `submit` function, add a `momentum` branch after the `hash` branch:

```ts
    if (kind === "address") {
      navigate(`/address/${normalizeAddress(q)}#portfolios`);
    } else if (kind === "hash") {
      navigate(`/tx/${normalizeHash(q)}`);
    } else if (kind === "momentum") {
      navigate(`/momentum/${normalizeMomentum(q)}`);
    } else if (kind === "ambiguous") {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    }
```

Update the default placeholder prop value:

```ts
  placeholder = "Search by Address, Hash, or Momentum #",
```

- [ ] **Step 2: Update the nav search placeholder**

In `src/app/layout/TopNav.tsx`, change the `SearchInput` placeholder prop:

```tsx
            <SearchInput
              compact
              enableShortcut
              placeholder="Search by Address, Hash, or Momentum #"
            />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/SearchInput.tsx src/app/layout/TopNav.tsx
git commit -m "feat: route momentum-number searches and update placeholders

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Search page momentum navigation

**Files:**
- Modify: `src/app/pages/Search.tsx`

- [ ] **Step 1: Add the momentum redirect**

In `src/app/pages/Search.tsx`, after the `tx` redirect line, add:

```tsx
  if (kind === "momentum" && target) return <Navigate to={`/momentum/${target}`} replace />;
```

Also update the help text at the bottom of the component so it mentions momentum:

```tsx
      <p>Try a full Zenon address (starts with <code className="mono">z1</code>), a 64-character account-block hash, or a momentum height.</p>
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/Search.tsx
git commit -m "feat: redirect ambiguous-search momentum results to the momentum page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Momentum detail components

**Files:**
- Create: `src/app/components/momentum/MomentumHeader.tsx`
- Create: `src/app/components/momentum/MomentumHeader.module.css`
- Create: `src/app/components/momentum/MomentumDetailsTable.tsx`

These are presentational components verified via the page (Task 9) and typecheck.

- [ ] **Step 1: Create the header component**

Create `src/app/components/momentum/MomentumHeader.tsx`:

```tsx
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./MomentumHeader.module.css";

interface Props {
  height: number;
  /** Chain tip; when known, disables "next" at the tip. Null = unknown (allow). */
  latest: number | null;
}

export function MomentumHeader({ height, latest }: Props) {
  const hasPrev = height > 1;
  const hasNext = latest == null ? true : height < latest;

  return (
    <header className={styles.wrap}>
      <h1 className={styles.title}>Momentum Details</h1>
      <nav className={styles.nav} aria-label="Momentum navigation">
        {hasPrev ? (
          <Link to={`/momentum/${height - 1}`} className={styles.arrow} aria-label="Previous momentum">
            <ChevronLeft size={16} />
          </Link>
        ) : (
          <span className={`${styles.arrow} ${styles.disabled}`} aria-disabled="true">
            <ChevronLeft size={16} />
          </span>
        )}
        <span className={`mono ${styles.height}`}>{height.toLocaleString()}</span>
        {hasNext ? (
          <Link to={`/momentum/${height + 1}`} className={styles.arrow} aria-label="Next momentum">
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span className={`${styles.arrow} ${styles.disabled}`} aria-disabled="true">
            <ChevronRight size={16} />
          </span>
        )}
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Create the header styles**

Create `src/app/components/momentum/MomentumHeader.module.css`:

```css
.wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  margin-bottom: 14px;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.nav {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-success);
}
.arrow:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.disabled {
  color: var(--color-subtle);
  opacity: 0.5;
  pointer-events: none;
}

.height {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-success);
  min-width: 96px;
  text-align: center;
}
```

- [ ] **Step 3: Create the details table**

Create `src/app/components/momentum/MomentumDetailsTable.tsx` (reuses the transaction table's CSS module for visual consistency):

```tsx
import { Link } from "react-router-dom";
import type { MomentumDetail } from "@shared/api/nomscan";
import { formatTimestamp } from "@shared/format/time";
import styles from "../tx/TxDetailsTable.module.css";

interface Props {
  momentum: MomentumDetail;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className={styles.row}>
      <th scope="row" className={styles.label}>{label}</th>
      <td className={styles.value}>{children}</td>
    </tr>
  );
}

function Mono({ value }: { value: string }) {
  return <span className={`mono ${styles.mono}`}>{value}</span>;
}

function rawJson(m: MomentumDetail): string {
  try {
    return JSON.stringify(m, null, 2);
  } catch {
    return String(m);
  }
}

export function MomentumDetailsTable({ momentum }: Props) {
  const producerLabel = momentum.producer_name || momentum.producer_owner || null;

  return (
    <>
      <table className={styles.table}>
        <tbody>
          <Row label="Momentum Hash"><Mono value={momentum.hash} /></Row>
          <Row label="Momentum Height"><Mono value={momentum.height.toLocaleString()} /></Row>
          <Row label="Timestamp">
            {momentum.timestamp != null ? formatTimestamp(momentum.timestamp) : <span className={styles.muted}>—</span>}
          </Row>
          <Row label="Producer">
            {momentum.producer ? (
              <Link to={`/address/${momentum.producer}#portfolios`} className={`mono ${styles.link}`}>
                {momentum.producer}
              </Link>
            ) : <span className={styles.muted}>—</span>}
            {producerLabel ? <span className={styles.muted}> ({producerLabel})</span> : null}
          </Row>
          <Row label="Previous Hash">
            {momentum.previous_hash ? (
              <Link to={`/momentum/${momentum.height - 1}`} className={`mono ${styles.link}`}>
                {momentum.previous_hash}
              </Link>
            ) : <span className={styles.muted}>—</span>}
          </Row>
          <Row label="Tx Count">
            {momentum.tx_count != null ? momentum.tx_count.toLocaleString() : <span className={styles.muted}>—</span>}
          </Row>
        </tbody>
      </table>

      <h2 className={styles.rawHeading}>Raw data</h2>
      <pre className={styles.pre}>{rawJson(momentum)}</pre>
    </>
  );
}
```

- [ ] **Step 4: Add the `rawHeading` style to the shared table CSS**

In `src/app/components/tx/TxDetailsTable.module.css`, add this rule (so the heading style is defined in the module being imported):

```css
.rawHeading {
  font-size: 14px;
  font-weight: 700;
  margin: 18px 0 8px;
  color: var(--color-text);
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/momentum/ src/app/components/tx/TxDetailsTable.module.css
git commit -m "feat: add momentum header (prev/next nav) and details table components

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: MomentumPage + route registration

**Files:**
- Create: `src/app/pages/MomentumPage.tsx`
- Modify: `src/app/router.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/pages/MomentumPage.tsx`:

```tsx
import { useParams } from "react-router-dom";
import { useMomentum, useLatestMomentumHeight } from "../api/queries";
import { MomentumHeader } from "../components/momentum/MomentumHeader";
import { MomentumDetailsTable } from "../components/momentum/MomentumDetailsTable";
import { Breadcrumb } from "../components/Breadcrumb";
import { MomentumBadge } from "../components/MomentumBadge";
import { SkeletonRows } from "../components/state/Skeleton";
import { ErrorState } from "../components/state/ErrorState";
import { NotFoundState } from "../components/state/NotFoundState";
import { isMomentumHeight, normalizeMomentum } from "@shared/validate/identifier";

export function MomentumPage() {
  const { height = "" } = useParams<{ height: string }>();
  const valid = isMomentumHeight(height);
  const normalized = valid ? normalizeMomentum(height) : "";
  const q = useMomentum(normalized);
  const latest = useLatestMomentumHeight();

  if (!valid) {
    return (
      <NotFoundState
        title="Invalid momentum height"
        {...(height ? { query: height } : {})}
        message="A momentum height is a positive whole number."
      />
    );
  }

  const heightNum = Number(normalized);
  const crumb = (
    <Breadcrumb
      items={[
        { label: "Home", to: "/" },
        { label: "Momentum" },
        { label: `#${heightNum.toLocaleString()}` },
      ]}
      rightSlot={<MomentumBadge />}
    />
  );

  if (q.isLoading) {
    return (
      <div>
        {crumb}
        <MomentumHeader height={heightNum} latest={latest} />
        <SkeletonRows rows={6} height={28} />
      </div>
    );
  }

  if (q.isError) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  if (!q.data) {
    return (
      <div>
        {crumb}
        <NotFoundState
          title="Momentum not found"
          query={normalized}
          message="No momentum matches this height."
        />
      </div>
    );
  }

  return (
    <div>
      {crumb}
      <MomentumHeader height={heightNum} latest={latest} />
      <MomentumDetailsTable momentum={q.data} />
    </div>
  );
}
```

- [ ] **Step 2: Register the route**

In `src/app/router.tsx`:

Add the lazy import alongside the others:

```tsx
const MomentumPage = lazy(() => import("./pages/MomentumPage").then((m) => ({ default: m.MomentumPage })));
```

Add the route after the `/tx/:hash` entry:

```tsx
          { path: "/momentum/:height", element: <MomentumPage /> },
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Verify the full test suite and lint pass**

Run: `npm test`
Expected: PASS (all suites).

Run: `npm run lint`
Expected: PASS (no new errors).

- [ ] **Step 5: Manual smoke (dev server already runs in background)**

Verify with the running dev server (`http://localhost:5173`):

```bash
# Search dispatch → momentum kind (needs the local indexer running)
curl -s "http://localhost:5173/api/search?q=1" | head -c 200
# Direct momentum route
curl -s "http://localhost:5173/api/momentum/1" | head -c 300
```

Expected: `/api/search?q=1` returns `{"ok":true,"data":{"kind":"momentum",...}}` (or `not_found` if height 1 isn't indexed); `/api/momentum/1` returns `{"ok":true,"data":{...}}`. If the local indexer isn't running, both return an upstream error envelope — that's acceptable for this smoke; the shapes are covered by unit tests. Also load `http://localhost:5173/momentum/1` in a browser and confirm the page renders header + details + Raw data.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/MomentumPage.tsx src/app/router.tsx
git commit -m "feat: add /momentum/:height detail page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10 (optional bonus): Link tx momentum height to the momentum page

**Files:**
- Modify: `src/app/components/tx/TxDetailsTable.tsx`

- [ ] **Step 1: Make the Momentum Height row a link**

In `src/app/components/tx/TxDetailsTable.tsx`, replace the `Momentum Height` row body:

```tsx
        <Row label="Momentum Height">
          {tx.momentum_height != null ? (
            <Link to={`/momentum/${tx.momentum_height}`} className={`mono ${styles.link}`}>
              {tx.momentum_height.toLocaleString()}
            </Link>
          ) : <span className={styles.muted}>—</span>}
        </Row>
```

(`Link` is already imported in this file.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/tx/TxDetailsTable.tsx
git commit -m "feat: link tx momentum height to the momentum page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria

- A bare integer in the search box navigates to `/momentum/:height`.
- `/momentum/:height` shows hash, height, timestamp, producer (linked), previous hash (derived), tx count, and a Raw data JSON block.
- Prev/next navigation works and disables at height 1 and the chain tip.
- `npm test`, `npm run typecheck`, and `npm run lint` all pass.
- Hash search remains unimplemented by design — see the two indexer requests in the spec.
