# NomScan Peer-Review Brief for Codex

You are reviewing **NomScan**, a Zenon Network block explorer. The repo was scaffolded from scratch in this session and the current code represents **Phases 1 and 2** of an approved 4-phase plan. Your job: act as a senior peer reviewer and produce a findings document. Do not modify code unless explicitly asked.

---

## 1. Context — what was built and why

- **Product spec:** `NOMSCAN_SPEC.md` (~685 lines). The authoritative product description.
- **Architecture cheat sheet:** `CLAUDE.md` (concise, written for future Claude instances).
- **Approved implementation plan:** `/Users/dfriestedt/.claude/plans/let-s-plan-to-build-witty-engelbart.md` if accessible; otherwise inferable from the code structure and the "Phase 1/Phase 2" tasks in `package.json` scripts and folder layout.
- **Shape**: Cloudflare Worker + React SPA via the `@cloudflare/vite-plugin`, single project, single deploy target. The Worker serves the SPA *and* proxies authenticated requests to `nom-indexer-go` so the JWT never reaches the browser.
- **Phases 1 and 2 scope:** scaffold, Worker proxy, shared types, theme tokens, home/search, address page (portfolio + transactions tabs), transaction detail page, loading/empty/error states.
- **Phases 3 (auth + D1 + watchlist via email magic links) and 4 (polish) are explicitly OUT of scope**. Route stubs reserve `/login`, `/account`, `/account/watchlist` but render "Coming soon".

Mid-implementation, the user added several iterative requirements that landed in the current code: USD price column on the portfolio (`api.zenon.info/price`), symbol aliasing (`WBTC → btc`), stale-fallback for price gaps, Worker-side caching with per-page TTLs, larger default page size (50), real `pagination.total` driving "Page N of M" + jump-to-page, and a fix for a strict-CSP-vs-Vite-Fast-Refresh bug that broke direct navigation.

---

## 2. Reading order

Read in this order — earlier files explain context for later ones:

1. `NOMSCAN_SPEC.md` — product spec. Skim sections "Data Integration", "Architecture", "Visual Design", "Security", "Acceptance Criteria".
2. `CLAUDE.md` — short architectural pointers.
3. `wrangler.jsonc`, `package.json`, `vite.config.ts`, `tsconfig.app.json`, `tsconfig.worker.json` — build/runtime config.
4. `src/shared/api/nomscan.ts` — the load-bearing public API contract between Worker and React.
5. `src/worker/index.ts`, `router.ts`, `upstream.ts`, `jwt.ts`, `respond.ts`, `cache.ts`, `errors.ts` — Worker core.
6. `src/worker/routes/*.ts` — endpoint handlers (status, search, address, tx, tokens, prices).
7. `src/shared/format/{amount,address,time,money}.ts` and `src/shared/validate/identifier.ts`, `src/shared/logic/direction.ts` — pure helpers.
8. `src/app/main.tsx`, `router.tsx` — React bootstrap.
9. `src/app/api/{client,queries}.ts` — TanStack Query layer.
10. `src/app/pages/{Home,Search,AddressPage,TxPage}.tsx` and `src/app/components/**` — UI.

---

## 3. Review areas

For each area below, list findings as severity-tagged items. Most areas have specific things I'm worried about — call those out by name if you see them.

### 3.1 Security (highest priority)

**The single load-bearing security invariant:** the upstream `NOM_INDEXER_JWT_SECRET` (in `.dev.vars`) and any minted JWT must never appear in the browser bundle, network tab, or rendered HTML.

Check:
- Run `npm run build` and then grep `dist/client/client/` for any occurrence of `NOM_INDEXER`, `Bearer eyJ`, or the literal value of `NOM_INDEXER_JWT_SECRET` from your local `.dev.vars` (do not include the value in any output you generate). All three must return nothing.
- Static-asset directory layout: the bundle lives at `dist/client/client/` and the Worker artifact at `dist/client/nomscan_local/`. Verify no `.dev.vars` or env values leak into the **client** directory. (A `.dev.vars` copy in the Worker artifact directory is expected and not a leak.)
- Confirm the Worker never echoes the JWT back in any response body (look at `src/worker/upstream.ts`, `src/worker/respond.ts`, and error paths in `src/worker/errors.ts`).
- CSP: `src/worker/index.ts` applies a strict CSP only when `env.NOMSCAN_ENV === "production"`. In `local`, no CSP is set so Vite's React Fast Refresh preamble works. Verify (a) the production CSP is sufficient for the *built* React bundle to run — particularly whether `script-src 'self'` blocks anything the bundle relies on, (b) `style-src 'self' 'unsafe-inline'` is necessary (we use CSS Modules; check whether Vite inlines styles in production), (c) the policy is missing any directive the spec requires.
- XSS: any `dangerouslySetInnerHTML` in the codebase? It should be **zero**. Decoded input on the transaction detail page is rendered inside `<pre>` as plain text — confirm that path doesn't bypass React's escaping.
- Input validation: every Worker route that takes a path param (address, hash, token standard) is `encodeURIComponent`'d into the upstream URL. Verify there's no path where untrusted input is concatenated raw.
- Logging: `console.error` is used in the Worker. Verify nothing logs the JWT or the secret.

### 3.2 Worker — JWT minting and upstream auth

File: `src/worker/jwt.ts`.

- HS256 signing: `mintHs256` uses `crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign'])`. Verify the secret is treated as raw UTF-8 bytes — confirm `nom-indexer-go` validates the same way. (The secret in `.dev.vars` looks base64-encoded; if upstream expects base64-decoded raw bytes, signature will fail. Currently works against the local indexer, but flag the assumption.)
- In-memory cache: `cached: CachedJwt | null` at module scope. Confirm this is safe across Worker isolates and refreshes correctly (TTL 300s, refresh-before-expiry 30s).
- Fallback to `env.NOM_INDEXER_JWT` (pre-minted) if present — make sure `getNomIndexerJwt` doesn't mint when a pre-minted JWT is set.
- Base64url encoder (`base64url`): check correctness on bytes containing high values, the `Uint8Array` indexing with the non-null assertion (`bytes[i]!`), and trailing `=` padding stripping.

### 3.3 Worker — proxy envelope and error mapping

Files: `src/worker/respond.ts`, `src/worker/errors.ts`, `src/worker/upstream.ts`.

- Envelope contract (`NomScanResponse<T>` in `src/shared/api/nomscan.ts`): every Worker route returns either `{ok:true, data, pagination?}` or `{ok:false, error: {code, message, status, retryAfter?}}`. Spot-check each route returns this shape.
- `errorFromThrown` logs the upstream error message server-side (which may include path detail) and returns a generic user-facing message. Confirm the user-facing message never includes the upstream's `detail` field unfiltered.
- 429 handling: `parseRetryAfter` accepts both seconds-as-integer and HTTP-date. Verify the resulting `retryAfter` is correctly mirrored both in the JSON body **and** the `Retry-After` response header by `err()`.
- Status code mapping in `mapUpstreamStatus`: 401/403 → `upstream_auth`, 404 → `not_found`, 429 → `rate_limited`, 503 → `upstream_unavailable`, ≥500 → `upstream_error`, ≥400 → `bad_request`. Is this complete? What about 400 with problem+json detail — are we losing information?

### 3.4 Worker — caching

Files: `src/worker/cache.ts`, `src/worker/routes/prices.ts`, `src/worker/routes/address.ts`, `src/worker/routes/tokens.ts`.

- `withCache(request, ttl, producer)`: caches under `request.url`. Skips cache for non-GET. Only caches `fresh.ok`. Verify this is correct — what about cached 404s for non-existent addresses (probably fine to skip, but flag if you disagree).
- TTL strategy in `getAddressTransactions`:
  - `sort=asc & page=1` → 24h (first block is immutable forever)
  - `sort=desc & page=1` → 5s (newest grows with new tx)
  - all other pages → 5min (historical, ~immutable)
  Is this correct given upstream's offset-based pagination semantics? If tx count grows on page 1 and pushes the tail into page 2, our 5min cache on page 2 will serve a row that's now actually on page 3. Acceptable trade-off?
- Prices: `src/worker/routes/prices.ts` has a non-trivial two-cache scheme:
  - Fresh cache (60s) under the request URL.
  - Last-known-good cache (5min) under `https://nomscan.internal/_last-known-prices`.
  - On upstream success: merge `{...lastKnown, ...upstream}` so upstream wins per-key and last-known fills gaps. Update both caches.
  - On upstream failure: serve last-known unchanged, do **not** update either cache (so stale data ages out within 5 minutes).
  - On both empty: return 503.
  Trace this carefully. Edge cases: upstream returns `data: {}` (empty but successful — currently treated as fresh and overwrites last-known with empty merged → could blank everything). Confirm whether this is handled or a latent bug.
- `caches.default` is per-edge-colo. In a multi-colo production deploy, different regions have independent caches. Flag whether this matters for anything (probably fine).

### 3.5 React — data layer

Files: `src/app/api/client.ts`, `src/app/api/queries.ts`.

- `nomscanFetch<T>` parses the response JSON, throws `NomScanFetchError` on `{ok:false}`. Confirm the response type narrows correctly when `ok:true`.
- `useAddressTransactions`: `placeholderData: keepPreviousData` keeps the previous page visible while the next loads. `usePrefetchNextTransactions` warms page N+1 only if `hasNext`. Verify the `useEffect` deps are right (no stale closures over `params.page`).
- `useTokens` dedups via `Set` and uses `useQueries` — confirm it doesn't re-fire for the same standard across the address page (the Portfolio tab and Transactions tab can both reference the same token standard, but they live on the same page so should share the same `useQuery` cache by key).
- `useAddressActivityBounds`: two queries with `pageSize=1` (oldest + newest). Cheap. Verify the `staleTime` for the oldest is 24h (matches Worker TTL) and that we read `momentum_timestamp` correctly via the `txTimestamp` helper.
- `usePrices`: 60s staleTime, 5-min refetch interval. Confirm refetch happens in background without blocking UI.

### 3.6 React — hashed tabs and routing

Files: `src/app/hooks/useHashTab.ts`, `src/app/router.tsx`, `src/app/pages/AddressPage.tsx`.

- Direct nav to `/address/:addr#transactions` must activate the Transactions tab on first paint. There was a recent bug where strict CSP blocked Vite's preamble and React never mounted — verify the fix in `src/worker/index.ts` (`env.NOMSCAN_ENV === "production"` gate) actually works in both local and production.
- `useHashTab` reads `useLocation().hash` and uses `useMemo` to derive the active tab. Test mentally for: empty hash, unknown hash (`#foo`), hash with query (`#transactions?x=1`), trailing slash.
- Address validation in `AddressPage.tsx`: if `!isAddress(address)`, renders `NotFoundState`. The validation regex `/^z1[02-9ac-hj-np-z]{37,}$/` is intentionally permissive (Bech32-shaped). Confirm we never make upstream calls with a clearly-invalid address.
- `setTab` in `useHashTab` calls `navigate({hash}, {replace:true})`. Verify back-button behavior isn't broken (tab clicks shouldn't pollute history).

### 3.7 React — formatting and amounts

Files: `src/shared/format/amount.ts`, `src/shared/format/money.ts`.

- `formatAmount(raw, decimals, opts?)`: uses string arithmetic only; never `Number()`. Verify cases: empty string, leading `-`, zero, decimals=0, very long fractional part with `trimZeros: true`, `group: true` with negative numbers.
- `parseAmount(input, decimals)`: meant for write paths (not used in MVP). Quick sanity check.
- `rawToNumber(raw, decimals)` in `money.ts`: deliberately lossy (Number precision) for USD valuation. Confirm the comment is clear and that it's never used for transport.
- `formatUsd`: edge cases — `0`, `< $0.01`, negative tiny values, `NaN`, `null`/`undefined`.

### 3.8 Spec alignment

Compare the code against `NOMSCAN_SPEC.md` § "Acceptance Criteria" (around line 626). Specifically:

- "A user can search a Zenon address from `/` and land on `/address/:address#portfolios`." ✓ verify in `src/app/components/SearchInput.tsx`.
- "Address page has Portfolio and Transactions tabs matching the requested hash URLs." Tab IDs are `portfolios` (plural) and `transactions` — matches the spec's "Portfolio tab" but the hash is plural. Confirm consistent.
- "All nom-indexer-go calls go through the Cloudflare Worker proxy."
- "No nom-indexer-go JWT appears in the frontend bundle, network inspector, or page source."
- "The app works at 375px width without broken layout." — verify by inspecting CSS modules' media queries; no Playwright test yet.
- "A user can log in, save an address, label it, and see it in their account watchlist." — **out of scope** (Phase 3).

The spec also mandates several visual conventions (Montserrat, dark theme tokens, max content width 1180–1280px). Spot-check `src/app/styles/tokens.css` matches the 16 enumerated variables in the spec verbatim.

### 3.9 TypeScript strictness

- `tsconfig.app.json` and `tsconfig.worker.json` enable `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. Look for places where this is bypassed via `as any`, `!`, or untyped accesses (e.g. `(summary as Record<string, unknown>)["foo"]` in `AddressSummary.tsx` — is this principled?).
- The `TxRow` / `TxDetail` types include `momentum_timestamp` as the upstream-canonical field; the `txTimestamp(tx)` helper falls back to `timestamp`. Verify every consumer uses the helper (not raw `tx.timestamp`).

### 3.10 Cross-cutting code quality

- Folder layout (`src/{app,worker,shared}`) and path aliases (`@app/*`, `@shared/*`, `@worker/*`) — any places where the wrong alias is used or a relative path leaks?
- Dead code, unused exports, unused CSS classes.
- Component prop drilling vs context — anything obviously over-engineered or under-extracted?
- Accessibility: `aria-label` on icon-only buttons (CopyButton, Pagination), `role="tablist"` / `role="tab"` on tabs, `aria-live` on Toast. Verify these are correct.

---

## 4. Explicitly out of scope (don't review)

- **Phase 3** code (auth, D1, watchlist, magic links). Route stubs are intentional.
- **Phase 4** items: a11y deep pass, Lighthouse perf budgets, Sentry/analytics, preview env, optional portfolio sections (stakes, fusions, rewards, bridge wraps/unwraps).
- **Test suites**: Vitest and Playwright are installed but no tests exist. Note this as a gap but don't write tests.
- **OpenAPI codegen**: `npm run codegen:api` script exists but `src/shared/api/nom-indexer.d.ts` is not committed. Worker uses hand-written types from `src/shared/api/nomscan.ts`. This is by design.
- **Production deploy validation**: `env.production` block has a placeholder `NOM_INDEXER_BASE_URL`. Production CSP behavior can be reasoned about but not exercised.
- **The `.dev.vars` file**: contains a real local-dev signing secret. Do not include the value in any review output.

---

## 5. Verification commands to run

```bash
npm install                                   # if not already
npm run typecheck                             # must pass clean
npm run build                                 # must succeed
grep -rE "NOM_INDEXER|Bearer\s+eyJ" dist/client/client/   # must return nothing
# Plus: grep for the literal NOM_INDEXER_JWT_SECRET value from .dev.vars
# (read it once at runtime; do not paste it into your review or commit history).
```

If the dev server is running (`npm run dev` → `http://localhost:5173`), additionally hit:

```bash
curl -s http://localhost:5173/api/status | head -c 300
curl -s http://localhost:5173/api/prices  | head -c 300
curl -sI http://localhost:5173/                       # check security headers in local
curl -s  http://localhost:5173/api/address/z1qxemdeddedxplasmaxxxxxxxxxxxxxxxxsctrp/transactions?page=1\&page_size=50 | head -c 300
```

To repro the previously-fixed CSP-vs-preamble bug (should now succeed): visit `http://localhost:5173/address/<any-valid-address>#transactions` in a private/incognito browser session — the page must mount and the Transactions tab must be the active one.

---

## 6. Output format

Produce a single markdown file at `PEER_REVIEW.md` in the repo root. Structure:

```markdown
# NomScan Peer Review

## Summary
<2-3 sentences. Overall posture: ship as-is / ship with fixes / hold.>

## Critical
<Findings that block shipping. Include file:line, what's wrong, why it matters, suggested fix.>

## High
<Significant issues, should be fixed before merging.>

## Medium
<Worth fixing soon but not blocking.>

## Low / Nit
<Style, naming, minor refactors.>

## What looks good
<Brief — call out anything genuinely well-built so the implementer knows what to keep.>

## Open questions for the implementer
<Anything you couldn't decide on your own. Phrase as questions.>
```

For each finding, use this shape:

```markdown
### <Short title>
- **File:** `src/foo/bar.ts:42`
- **Issue:** <What's wrong>
- **Impact:** <Why it matters — security, correctness, perf, DX>
- **Suggested fix:** <Concrete change, or "discuss" if non-obvious>
```

Keep findings concrete and actionable. "Refactor for clarity" without a specific change is noise. Prefer one focused, specific finding over five vague ones.

---

## 7. Things to ignore that might look weird

- **`.dev.vars` is committed-shaped but gitignored.** It contains the local-dev signing secret. The user pasted it knowingly into the repo working dir; `.gitignore` keeps it out of version control.
- **Two different account-block counts on the address page.** "Blocks" (from `account_summary.block_count`) is sender-side; "Transactions" (from `pagination.total`) includes paired-receive blocks. Both are correct; the labels disambiguate.
- **Tab IDs are plural (`portfolios`, `transactions`).** Matches the Blockscan URL fragment convention referenced in `NOMSCAN_SPEC.md`.
- **`FEATURE_FIAT_VALUES = false` is gone.** Initially we hid the value column behind a flag; now we have real prices from `api.zenon.info`, so the column is unconditional. The Portfolio total row renders only if at least one row has a price.
- **WBTC → BTC alias** is intentional. See `src/shared/constants/price-aliases.ts`.
- **Stale-fallback price merge** is intentional. See § 3.4 above.
- **The Worker output dir contains `.dev.vars`** — this is wrangler emitting the local dev-only file, not a production leak. Production secrets ship via `wrangler secret put`.
- **No `momentum_timestamp` in older tx-row code paths** — the spec used `timestamp`; the upstream uses `momentum_timestamp`. The `txTimestamp(tx)` helper in `src/shared/api/nomscan.ts` handles both.

---

## 8. Tone and depth

Write like a senior engineer reviewing a colleague's PR — direct, specific, no hedging. Cite line numbers. Distinguish "this is a bug" from "I'd prefer different style." Keep the total review skimmable (target: under ~500 lines of markdown, fewer is better).

Do not modify any source files. Do not run destructive commands. Do not commit anything. The review document is the only artifact.
