# NoM Scan — Handoff

This is the doc to read first when picking the project back up after a break. It captures the current state, the load-bearing decisions, and where things live, so you don't have to reconstruct context from git log.

For background: [`PFSCAN_SPEC.md`](./PFSCAN_SPEC.md) is the original product spec, [`README.md`](../README.md) is the dev-setup quickstart, [`CLAUDE.md`](../CLAUDE.md) is a terse architectural cheat sheet aimed at future Claude Code sessions, and [`PEER_REVIEW.md`](./PEER_REVIEW.md) is the Codex peer-review snapshot.

---

## 1. Where we are right now

- **Implementation status:** Phases 1 and 2 of the approved 4-phase plan are merged into `main`. The public explorer (search, address pages with portfolio + transactions tabs, transaction detail page) is fully functional against a running local `nom-indexer-go`. Phase 3 (auth + D1 + watchlist via email magic links) and Phase 4 (a11y/perf deep passes, optional portfolio sections, preview env, analytics) are not started. Route stubs at `/login`, `/account`, `/account/watchlist` render "Coming soon" placeholders so the URLs are reserved.
- **Display brand:** "NoM Scan". Internal identifiers stayed "PFScan"/"pfscan" — see [§ 7. Naming](#7-naming).
- **Repo location on GitHub:** <https://github.com/0x3639/pfscan>.
- **Tip of `main`:** four commits (initial, peer-review + perf, UI rebrand pass, footer link). Linear history, no merge commits.
- **Quality gates** (all green at last check): `typecheck`, `lint`, `test` (10 tests), `build`, JWT-leak grep.

---

## 2. Getting back into local dev

```sh
# from repo root
npm install                # if your node_modules is stale
npm run dev                # Vite + Cloudflare Worker via @cloudflare/vite-plugin
# open http://localhost:5173
```

You need `nom-indexer-go` running locally on `http://localhost:8080`. The Worker authenticates to it by minting short-lived HS256 JWTs from the secret in `.dev.vars` (the file is gitignored). If the indexer isn't running, the UI shell renders but `/api/*` calls fail.

Common commands:

| | |
|---|---|
| `npm run dev` | local dev server (Vite + Worker, single process via cloudflare/vite-plugin) |
| `npm run build` | production client + Worker build into `dist/` |
| `npm run typecheck` | TypeScript project-reference check |
| `npm run lint` | ESLint flat config |
| `npm test` | Vitest unit tests |
| `npm run codegen:api` | regenerate `src/shared/api/nom-indexer.d.ts` from the upstream OpenAPI (currently not committed — hand-written types live in `src/shared/api/pfscan.ts`) |
| `npm run deploy:production` | `wrangler deploy --env production` (production env vars/secrets must be configured first; see [§ 8. Deploying](#8-deploying)) |

---

## 3. Architecture at a glance

**Single Cloudflare Worker serves the SPA and proxies the upstream.** The Worker hosts both the static React bundle and a thin `/api/*` proxy layer that talks to `nom-indexer-go`. No CORS, no separate origin, one deploy target.

```
                                     ┌─ static assets (HTML/JS/CSS/fonts)
Browser ──> Cloudflare Worker ──┤
                                     └─ /api/*  ──> mints JWT ──> nom-indexer-go
                                     └─ /api/prices ──> api.zenon.info/price
```

Key invariant the whole architecture exists to enforce: **the `NOM_INDEXER_JWT_SECRET` must never reach the browser**. Production deploys verify this with a `grep` over `dist/client/client/` (currently passes — see security checks below).

**Two-tier API on purpose.** The React app talks only to PFScan's own `/api/*` shapes (`PFScanResponse<T>` envelope). The Worker translates to upstream calls. This keeps the upstream contract decoupled from the UI, lets us cache aggressively, lets us mint JWTs at the boundary, and lets us shape responses to fit React's needs (e.g. token enrichment, error mapping).

**Three caching layers stacked:**

1. **Browser** — sets `Cache-Control` from Worker responses; respects short TTLs for status (5s), longer for token metadata (24h), etc.
2. **Worker** — `caches.default` (Cloudflare Cache API) for status, prices, address transactions, and tokens. Per-route TTLs:
   - tx list page 1 desc → 5s (newest data, freshness matters)
   - tx list page 1 asc → 24h (the first block ever is immutable)
   - tx list pages 2+ → 5min (historical, effectively immutable)
   - tokens → 24h (token metadata is stable)
   - prices → 60s "fresh", plus 5-minute "last-known-good" stale fallback so a momentary upstream gap doesn't blank ZNN's value
   - status → 5s
3. **React (TanStack Query)** — in-memory dedup with per-query `staleTime`. See `src/app/api/queries.ts`.

The browser also gets `placeholderData: keepPreviousData` on the transactions query, so paging forward shows the previous page faded until the new one arrives. And `usePrefetchNextTransactions` warms page N+1 in the background while you read page N. Together: Next click is usually instant.

**Environment selection is deploy-time, not code-time.** The Worker reads the same env var names (`NOM_INDEXER_BASE_URL`, `NOM_INDEXER_JWT_SECRET`, `PFSCAN_ENV`) regardless of environment. Local values come from `.dev.vars`; production values come from `wrangler.jsonc env.production.vars` (non-secret) and `wrangler secret put ... --env production` (secrets). The only env-aware code branch is in `src/worker/index.ts` — strict CSP only applies when `PFSCAN_ENV === "production"` (in dev, CSP would block Vite's React Fast Refresh inline preamble and React never mounts).

---

## 4. Code map

```
src/
├── app/                       # React SPA — runs in the browser
│   ├── main.tsx               # bootstraps React + QueryClientProvider + RouterProvider
│   ├── router.tsx             # createBrowserRouter, lazy routes, PageSuspense outlet
│   ├── api/
│   │   ├── client.ts          # pfscanFetch<T> — single entry point for /api/* calls
│   │   └── queries.ts         # all TanStack Query hooks (useAddressSummary, useAddressTransactions, etc.)
│   ├── components/
│   │   ├── SearchInput.tsx    # global search, drives hash/address dispatch
│   │   ├── Breadcrumb.tsx     # crumb + rightSlot adornment (e.g. MomentumBadge)
│   │   ├── MomentumBadge.tsx  # latest momentum height; renders nothing on missing data
│   │   ├── CopyButton.tsx     # copy-to-clipboard with check-icon feedback
│   │   ├── Pagination.tsx     # Prev/Next, First/Last, Page N of M, jump-to-page
│   │   ├── address/           # AddressHeader, AddressSummary, AddressTabs, PortfolioTab, TransactionsTab
│   │   ├── tx/                # TxTable, TxList (mobile), TxHeader, TxDetailsTable, DirectionBadge
│   │   └── state/             # Skeleton, EmptyState, ErrorState, NotFoundState
│   ├── hooks/                 # useHashTab, useCopy
│   ├── layout/                # RootLayout, TopNav, Footer, Container, PageSuspense
│   ├── pages/                 # Home, Search, AddressPage, TxPage, NotFound, ComingSoon
│   └── styles/                # tokens.css, global.css (Montserrat + resets)
│
├── worker/                    # Cloudflare Worker — runs at the edge
│   ├── index.ts               # entry: router dispatch, ASSETS fallback, security headers
│   ├── router.ts              # tiny URLPattern-based ApiRouter
│   ├── env.d.ts               # typed Env (NOM_INDEXER_BASE_URL, _JWT_SECRET, _JWT, _JWT_SUBJECT, PFSCAN_ENV, ASSETS)
│   ├── jwt.ts                 # HS256 minting via crypto.subtle; in-memory cache; pre-minted JWT fallback
│   ├── upstream.ts            # nomIndexerFetch — attaches Bearer, parses JSON/problem+json
│   ├── respond.ts             # ok(), err(), errorFromThrown — the {ok:true, data} / {ok:false, error} envelope
│   ├── cache.ts               # withCache(request, ttl, producer) helper over caches.default
│   ├── errors.ts              # UpstreamError + mapUpstreamStatus (401→upstream_auth, 429→rate_limited, etc.)
│   ├── routes/                # status, search, address (summary/balances/transactions), tx, tokens, prices
│   └── services/tokens.ts     # getToken(env, standard) with per-isolate memoization
│
└── shared/                    # used by both Worker and React via @shared/* path alias
    ├── api/pfscan.ts          # PFScanResponse, error/pagination types, AddressSummary, TxRow, TxDetail, etc.
    ├── validate/identifier.ts # detectQueryType, normalizeAddress, normalizeHash, isAddress, isHash
    ├── format/                # amount (BigInt-safe), money (USD), address (truncateMiddle), time (formatAge, formatDate, formatTimestamp)
    ├── logic/direction.ts     # getDirection(row, viewedAddress) → IN | OUT | SELF | PAIR
    └── constants/             # price-aliases.ts (WBTC→btc, WETH→eth)
```

Tests live in `src/shared/**/*.test.ts` (Vitest, jsdom). Currently 10 tests covering amount formatting, identifier detection, and direction logic.

---

## 5. The address page in detail (the heaviest screen)

When a user navigates to `/address/:addr#transactions`, this is what fires:

1. **`useAddressSummary`** → `/api/address/:addr/summary` → upstream `/api/v1/accounts/{addr}`. ~50ms cold. Returns `{block_count, tx_count, first_seen, last_seen, balances delta, …}`. The `tx_count`, `first_seen`, `last_seen` fields were added by the indexer team in response to a perf ask; before they existed, we fired two extra "bound" queries to derive timestamps, which on large addresses cost 8–18 seconds.
2. **`useAddressBalances`** → `/api/address/:addr/balances`. ~100ms. The Worker enriches each balance with `getToken(standard)` so the table has symbol/decimals without a per-row fetch.
3. **`useAddressTransactions`** → `/api/address/:addr/transactions?page=1&page_size=50&sort=desc`. ~500ms cold even on a 209k-block address (was 47s before the indexer started sourcing `pagination.total` from the cached `tx_count` counter instead of doing a `COUNT(*)`).
4. **`useTokens`** (called by `TxTable` / `TxList`) → fires one `/api/tokens/:std` per unique token standard in the page, deduped via `useQueries`. Cache-hit at the Worker layer (24h TTL).
5. **`usePrices`** → `/api/prices` → upstream `api.zenon.info/price`. ~50ms warm. Drives the Portfolio tab's USD value column and total.
6. **`usePrefetchNextTransactions`** → page N+1 fires in background while user reads page N. Makes Next click feel instant.

The page renders progressively: header → summary cards → tab content. Skeletons appear on slow queries, then fade in. With Worker cache warm, the whole page is sub-100ms.

`useHashTab` synchronizes the active tab with the URL hash (`#portfolios` / `#transactions`). Direct loads to `/address/X#transactions` activate the right tab on first paint because React Router's `useLocation().hash` is reactive from the initial render.

---

## 6. Performance story (timeline, useful context)

Each entry is the iteration as it happened — keeping this here so future-you knows *why* the current shape exists.

1. **Initial Phase 1+2 build.** Worker proxy with token enrichment baked into every endpoint. Address transactions returned the page rows with token metadata pre-attached.
2. **User flags "paging on 20k-block addresses is slow."** Diagnosis: the Worker was sequentially-paralleling N token fetches before responding. Fix: remove token enrichment from the tx list endpoint, push it to the client via `useTokens` which dedups across rows.
3. **Added `placeholderData: keepPreviousData`** to `useAddressTransactions` and `usePrefetchNextTransactions` for the prefetch. These don't reduce wall-clock cost but cut perceived latency to ~0 on Next clicks.
4. **Worker cache with per-page TTLs.** 5s for page 1 desc, 24h for page 1 asc (immutable first block), 5min for older pages. Re-visits within TTL are ~10ms.
5. **`pagination.total` surfaced in the UI.** Real "Page N of M" + jump-to-page input, since the indexer already returns total.
6. **User flags "two different account-block counts on the address page."** Diagnosis: `block_count` from the account is sender-only; `pagination.total` includes paired-receive blocks. Both correct, ambiguously labeled. Fix: relabel to "Blocks" and "Transactions" with tooltips; derive both from the existing data.
7. **First/Last active populated by deriving from oldest/newest tx.** Two small `page_size=1` queries (asc + desc). Asc cached 24h (immutable).
8. **User flags "Last active and Transactions counts still slow."** Diagnosis: the desc page=1 size=1 query was duplicating work with the main desc page=1 size=50 tx-list query. Tier 1 fix: rewrite `useAddressActivityBounds` to read from the same `useAddressTransactions(page=1, pageSize=50, sort=desc)` query — TanStack key-sharing.
9. **Worked out a Tier 2 proposal** for the indexer team: add `first_seen`, `last_seen`, `tx_count` to `/accounts/{address}` as O(1) per-account state. Indexer team implemented it. Tier 2 fix in PFScan: delete `useAddressActivityBounds` entirely; `AddressSummary` reads `first_seen`/`last_seen`/`tx_count` straight from the summary endpoint. Now summary populates in ~50ms regardless of address size.
10. **User flags "209k-tx address still slow."** Diagnosis: every `/transactions` call took 47s regardless of `page` or `page_size`, meaning the indexer was running `COUNT(*)` on every request. Asked the indexer team to source `pagination.total` from the cached `tx_count` counter. They did. **47s → 500ms.** PFScan code unchanged — pure indexer fix.
11. **Codex peer-review pass** (see `PEER_REVIEW.md`) caught and fixed: `TopNav.latest_height` field name, price-feed empty-success guard, search-route error mapping, `SearchInput` duplicate ids + competing `/` shortcuts, missing tab keyboard navigation, plus ESLint config + first unit tests + CLAUDE.md refresh.
12. **UI rebrand** PFScan → NoM Scan (display only — every internal identifier stayed).
13. **Footer:** added Zenon Hub link alongside Zenon Network and Zenon Tools.

---

## 7. Naming

The product was originally called "PFScan" (Proof Scan). It was renamed to **"NoM Scan"** late in development. The rename was display-only — every technical identifier stayed.

| What was renamed | What stayed |
|---|---|
| `<title>` and meta description | npm package name (`"pfscan"` in `package.json`) |
| TopNav brand, aria-label | Folder name (`proofscan/`) |
| Hero h1, footer brand | Worker name in `wrangler.jsonc` (`pfscan-local` / `pfscan`) |
| NotFound + ErrorState user-facing copy | Type names (`PFScanResponse`, `PFScanError`, `PFScanErrorCode`, `PFScanPagination`, `PFScanFetchError`, `PFScanResult`) |
| README + CLAUDE.md prose | Function names (`pfscanFetch`) |
|  | Log prefixes (`[pfscan]`) |
|  | Internal cache key (`pfscan.internal/_last-known-prices`) |
|  | Env var name (`PFSCAN_ENV`) |
|  | Spec file name (`PFSCAN_SPEC.md`) |
|  | Peer-review docs (historical artifacts) |

If you later want to rename internal identifiers too (e.g. to `nomscan`), it's mostly mechanical but touches the Worker name in `wrangler.jsonc` — if there's a production deploy by then, you'd need to migrate the Worker (or set up a new one + DNS swap). Don't rush it.

---

## 8. Deploying

There's no production deploy yet. When you're ready:

1. Decide the **production `NOM_INDEXER_BASE_URL`** and update `wrangler.jsonc → env.production.vars.NOM_INDEXER_BASE_URL` (currently a placeholder).
2. Set the **production signing secret** via `wrangler secret put NOM_INDEXER_JWT_SECRET --env production`. Optionally `NOM_INDEXER_JWT` if you have a pre-minted long-lived JWT. `NOM_INDEXER_JWT_SUBJECT` defaults to `"pfscan"` from the wrangler vars; override there if upstream expects a different `sub`.
3. Add a `routes` block in `wrangler.jsonc env.production` for your DNS (currently commented out with `pfscan.com` example).
4. `npm run deploy:production`.
5. Verify the JWT-leak grep on the built bundle:
   ```sh
   npm run build
   grep -rE "NOM_INDEXER_JWT|Bearer\s+eyJ" dist/client/client/         # must be empty
   ```
6. Visit the deployed URL, confirm strict CSP is applied (DevTools → Network → response headers should show `Content-Security-Policy` on HTML; it's intentionally absent in local dev so Vite's Fast Refresh preamble can run).

There's no preview/staging environment configured yet — adding one is a Phase 4 item.

---

## 9. Known gaps and open items

### Not built (and explicitly out of scope for now)
- **Phase 3:** email magic-link login, D1 schema (`users`, `sessions`, `saved_addresses`, `address_groups`, `address_group_members`, `user_settings`, `email_login_tokens`), watchlist UI, "Save" action on the address header. Route stubs at `/login`, `/account`, `/account/watchlist` reserve the URLs.
- **Phase 4:** accessibility deep pass (Lighthouse ≥ 95), Sentry/Cloudflare Analytics, the preview environment, optional portfolio sections (stakes, fusions, rewards, bridge wraps/unwraps), perf budget enforcement, broader Playwright/e2e suite.

### Carried-forward debt
- **Test coverage** (updated after the May 2026 audit). `vitest.workspace.ts` now defines a jsdom `unit` project and a node `worker` project (the latter with a minimal Cache API polyfill in `tests/worker/setup.ts`); `npm run test:worker` resolves. 77 tests cover the shared formatters/validators, the Worker envelope/error/jwt/clamp/cache/upstream helpers, and the search + address routes (mocked upstream). Still no Playwright e2e specs (`playwright.config.ts` not yet created — `npm run test:e2e` will fail until it is). Worker-route tests use a lightweight `caches` polyfill, not the full `@cloudflare/vitest-pool-workers` pool.
- **API codegen not committed.** `npm run codegen:api` exists but `src/shared/api/nom-indexer.d.ts` is simply **not committed** (it is *not* gitignored — it was never generated). Hand-written types in `src/shared/api/pfscan.ts` cover the Worker, the only consumer of upstream shapes. Run the codegen if you want strict upstream typing.
- **No openapi-fetch.** Worker uses a hand-rolled `nomIndexerFetch` helper. Fine for ~10 endpoints; revisit if it grows.
- **Theme is dark-only.** CSS variables are set up for light mode but no light tokens exist yet. The `data-theme="dark"` on `<html>` would just need a sibling `[data-theme="light"]` rule block plus a theme toggle.

### Cursor pagination (Tier 3 perf, deferred)
Offset pagination on the indexer's `/transactions` endpoint is fast enough now that `pagination.total` is O(1), but it's still O(N) at the offset for very deep pages. If anyone reports slowness paginating to page 4000 of 4187 on a busy address, the fix is cursor-based pagination on the indexer (`?before_momentum_height=…&limit=50`). Bigger indexer change, no immediate need.

### Open spec questions (unanswered from `PFSCAN_SPEC.md`)
1. Production `nom-indexer-go` base URL — placeholder in `wrangler.jsonc`.
2. Whether to support both `pfscan.com` and `www.pfscan.com` — moot now that the brand is "NoM Scan"; will likely become a question about `nomscan.io` or similar.
3. Magic-link email delivery provider for Phase 3 (Cloudflare Email Workers vs Resend vs Postmark).
4. Whether `/tx/:hash` should stitch send+receive paired blocks into one view (currently shows the exact account-block with a link to the paired hash — the simpler choice).
5. Light mode in MVP vs deferred.
6. Whether the indexer JWT needs a `scope: "read"` claim. Local works without it; production may differ.

---

## 10. Common dev tasks

### "Add a new field to the address summary"
1. Add the field to the upstream `/api/v1/accounts/{address}` response if it isn't there. Coordinate with the indexer team.
2. Add it to the `AddressSummary` interface in `src/shared/api/pfscan.ts`.
3. Read it in `src/app/components/address/AddressSummary.tsx`. Use the same pattern as `block_count`/`tx_count` — narrow with `typeof data?.field === "number" ? data.field : undefined`.
4. Render a new `<Card label="…">` in the grid.

### "Add a new `/api/*` endpoint"
1. Write the handler in `src/worker/routes/foo.ts`. Follow the pattern: return `ok(data, pagination?)` on success, `errorFromThrown(e)` in the catch.
2. Register the route in `src/worker/index.ts` (`api.get("/api/foo/:bar", getFoo)`).
3. Add a hook in `src/app/api/queries.ts` calling `pfscanFetch<T>("/api/foo/...")` with a stable `queryKey` and an appropriate `staleTime`.
4. If you need response types, declare them in `src/shared/api/pfscan.ts` so both Worker and React consume the same shape.
5. If the endpoint benefits from edge caching, wrap the handler body in `withCache(request, ttlSeconds, async () => { … })`.

### "Add a new page / route"
1. Create the component in `src/app/pages/Foo.tsx`.
2. Lazy-import it in `src/app/router.tsx` and add a route entry under `<PageSuspense />`.
3. If it should have a breadcrumb, render `<Breadcrumb items={[…]} rightSlot={<MomentumBadge />} />` near the top.

### "Add a unit test"
Vitest config picks up `src/**/*.test.ts(x)` and `tests/unit/**/*.test.ts`. Mirror the existing tests in `src/shared/format/amount.test.ts`. Run `npm test`.

### "Bump the upstream rate-limit envelope"
The Worker maps upstream 429 in `src/worker/errors.ts → mapUpstreamStatus`. `Retry-After` is parsed in `src/worker/upstream.ts → parseRetryAfter` and mirrored both as a response header and in the error envelope by `src/worker/respond.ts → err`. The client renders the countdown in `src/app/components/state/ErrorState.tsx`.

---

## 11. Where to look next

- **The product spec** ([`PFSCAN_SPEC.md`](./PFSCAN_SPEC.md)) is still the authoritative source for product intent. It was written before the rebrand — the name "PFScan" appears throughout but the product semantics are unchanged.
- **The peer-review snapshot** ([`PEER_REVIEW.md`](./PEER_REVIEW.md)) is a useful artifact for understanding what was considered "shipped" at that point. Open question #1 in that doc (JWT `scope: "read"` claim) is still unresolved.
- **`CLAUDE.md`** is a terse architectural cheat sheet kept up to date for future Claude Code sessions. Less narrative than this doc, more reference.
- **Worker logs** at runtime: `console.error("[pfscan] …")` lines appear in `wrangler dev` / `wrangler tail`. Useful for upstream error debugging.

If a future iteration takes more than a couple of weeks: come back here first, then read the last 10 commits on `main`, then dive in.
