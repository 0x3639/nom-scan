# NoM Scan Peer Review

_Refreshed 2026-05-28 (supersedes the prior review). Produced by a multi-agent
audit (security, correctness, spec-adherence, accessibility, docs, test gaps)
with adversarial verification, then re-verified by hand. Findings the verifier
could not reproduce are listed under "Refuted / corrected" rather than as issues._

## Summary

The core architecture is sound and the non-negotiable constraints hold:

- **Two-tier boundary intact.** The React app references neither `/api/v1/*`,
  `NOM_INDEXER`, nor `Bearer` (`grep -rn … src/app` → nothing). All upstream
  calls flow through `src/worker/upstream.ts`, which attaches
  `Authorization: Bearer ${getNomIndexerJwt(env)}`. The **browser-served** bundle
  (`dist/client/client/`) contains no secret, token, or upstream path.
- **Amounts stay strings** end-to-end; the only lossy `Number()` is isolated to
  USD display (`money.rawToNumber`).
- **Worker clamps `page_size` to 200**; **hash-tab state survives refresh**;
  **`/tx/:hash`** routing matches the spec.

This pass found no live critical leak. The most consequential finding — that a
production deploy could publish the upstream signing secret — was **downgraded on
verification**: the live deploy path uses the Vite/Cloudflare plugin's redirect
config, which serves the clean `dist/client/client` subdir, not the parent. It is
nevertheless now hardened (see Critical, below, marked FIXED). The remaining
findings are medium-and-below: a cluster of WCAG gaps, low/info correctness nits,
broken test infrastructure, and documentation drift — **most are fixed in this
pass** and tagged `[FIXED]`.

## Verification (this pass)

- `npm run typecheck` — passes
- `npm run lint` — passes
- `npm test` — **77 passing** (was ~10), across the `unit` + `worker` projects
- `npm run test:worker` — now resolves (39 passing)
- `npm run build` — passes
- `npm run check:assets` — ✅ clean; served tree has no secrets/Worker artifacts
- `grep -rIE "NOM_INDEXER|Bearer eyJ" dist/client/client/` — no matches

---

## Critical

### Worker artifacts (incl. a build-copied `.dev.vars`) were under the served assets parent  `[FIXED]`
- **File:** `wrangler.jsonc` (`assets.directory`)
- **Original concern:** the root config served the whole `./dist/client` tree —
  the parent of both the browser-asset dir (`dist/client/client/`) and the Worker
  output dir (`dist/client/nomscan_local/`), the latter containing a build-copied
  `.dev.vars` with the live `NOM_INDEXER_JWT_SECRET`. The audit rated this
  CRITICAL on the assumption that `deploy:production` deploys via the root config.
- **Correction (verified):** `vite build` writes `.wrangler/deploy/config.json`,
  which **redirects** `wrangler deploy` to the plugin-generated
  `dist/client/nomscan_local/wrangler.json`. That config narrows assets to
  `../client` (the clean browser dir), so the live deploy path never serves the
  secret. Separately, `wrangler deploy --env production` **errors** under that
  redirect (you must select the environment via the build tool, not `--env`) — so
  the documented command would fail before publishing anything. So the leak was
  **latent/defensive**, not live, and downgraded from critical.
- **Fix applied:** narrowed the root `assets.directory` to `./dist/client/client`
  (matching the plugin) so the root config is safe regardless of how wrangler is
  invoked; added `scripts/check-deploy-assets.mjs` (wired into
  `deploy:production` via `npm run check:assets`) that scans the served tree for
  `NOM_INDEXER_*` secrets, the literal `.dev.vars` value, and Worker artifacts and
  fails the deploy if any are present.
- **Still open (separate issue):** `deploy:production` uses `--env production`,
  which is incompatible with the plugin redirect. The production deploy flow needs
  to select the environment via the Vite plugin instead — this is tied to spec
  Open Question #1 (production indexer URL is still a `REPLACE-ME` placeholder), so
  no production deploy is functional yet. **Resolve before the first deploy.**

---

## High

None.

---

## Medium

### No global `:focus-visible` indicator  `[FIXED]`
- **File:** `src/app/styles/global.css`
- The reset stripped UA outlines from links/buttons and no global focus style
  replaced it (only CopyButton/AddressTabs had their own). Added a global
  `a/button/input/[tabindex]:focus-visible` outline (WCAG 2.4.7).

### Address page had no `<h1>`  `[FIXED]`
- **File:** `src/app/components/address/AddressHeader.tsx`
- The page heading was a styled `<span>`; every other page has an `<h1>`. Now an
  `<h1>` (margin/weight reset preserves the small-caps look). WCAG 1.3.1 / 2.4.6.

### No skip-to-content link  `[FIXED]`
- **File:** `src/app/layout/RootLayout.tsx`
- Added a visually-hidden-until-focused "Skip to content" link targeting
  `<main id="main" tabIndex={-1}>` (WCAG 2.4.1).

### Fiat "Value (USD)" column shipped without recording approval of Open Question #6  `[OPEN — needs user decision]`
- **File:** `src/app/components/address/PortfolioTab.tsx`
- The USD column + portfolio total (fed by `api.zenon.info/price`) is permitted by
  the spec's operative line ("…unless a price source is integrated"), so this is a
  **process/documentation** gap, not a code defect: Open Question #6 ("approved
  price source?") is still listed UNRESOLVED in `NOMSCAN_SPEC.md`. **Action:**
  confirm `api.zenon.info/price` is acceptable and mark Q6 resolved in the spec, or
  gate the column behind a flag / `N/A`.

---

## Low

- **API JSON lacked `nosniff` / `Referrer-Policy`**  `[FIXED]` — `src/worker/respond.ts`.
  Added `X-Content-Type-Options: nosniff` and `Referrer-Policy` to `JSON_HEADERS`
  (the HTML-only header wrapper skipped API responses). _Note: the audit's claim
  that error bodies are query-reflective was refuted — all `err()` messages are
  static literals._
- **Worker routes proxied unvalidated identifiers**  `[FIXED]` —
  `src/worker/routes/address.ts`, `tx.ts`. Now validate with `isAddress()` /
  `isHash()` and return a local 400 for malformed input (saves the shared
  60 req/min budget; no SSRF/injection existed — params are `encodeURIComponent`'d
  against a fixed base URL).
- **Address regex accepted wrong/over-length strings**  `[FIXED]` —
  `src/shared/validate/identifier.ts`. Pinned `ADDRESS_RE` to a fixed 38-char body
  (`{38}`) instead of `{37,}`.
- **Phantom Next on an exactly-full final page**  `[FIXED]` —
  `src/app/components/address/TransactionsTab.tsx`. When upstream omits
  `pagination.total`, a final page of exactly 50 rows left Next enabled; clicking
  it showed a blank table. Now any empty page renders a graceful "No more
  transactions" state with a Back control.
- **Incomplete ARIA tabs pattern**  `[FIXED]` — `AddressTabs.tsx` /
  `AddressPage.tsx`. Added `id`/`aria-controls` to each tab and a
  `role="tabpanel"` wrapper with `aria-labelledby`.
- **Pagination tap targets below recommended size on mobile**  `[FIXED]` —
  `Pagination.module.css`. Added a ≤640px rule bumping `.btn`/`.pageInput` to
  `min-height: 40px` (passes WCAG 2.5.8 AA; the buttons were not a hard failure).
- **Momentum height not in the global shell**  `[OPEN — intentional]` —
  `src/app/layout/TopNav.tsx`. `MomentumBadge` renders only on the address page;
  the spec describes it "on every page". The relocation was deliberate (commit
  `c6ca707`). **Action:** update `NOMSCAN_SPEC.md` to match, or re-mount it in the
  shell. (Left as-is; low priority.)

---

## Info (consistency)

- **`SearchInput` address branch**  `[FIXED]` — now uses `normalizeAddress(q)` for
  symmetry with the hash branch (no-op today; `normalizeAddress` only trims).
- **`useAddressTransactions` default `pageSize`**  `[FIXED]` — aligned to 50 (was a
  dead `25`) to prevent drift from the Worker default / UI `PAGE_SIZE`.
- **Relative-age uses fixed 30-day months / 365-day years**  `[WONTFIX]` —
  `src/shared/format/time.ts`. Cosmetic drift in the "_mo/_y ago_" badge only;
  the industry-standard approximation. Left as-is.

---

## Refuted / corrected

- **"Direction badge omits the spec's RECEIVE value"** — refuted. The spec offers
  `RECEIVE` and `PAIR` as interchangeable for the same case; `IN` when `to_address`
  matches the viewed address is exactly what the spec prescribes. No defect.
- **Critical leak severity** — corrected from critical to defensive (see Critical).

---

## Documentation

- **`CLAUDE.md` JWT auth**  `[FIXED]` — corrected to describe the real primary path
  (mint HS256 from `NOM_INDEXER_JWT_SECRET`; `NOM_INDEXER_JWT` is the fallback;
  `NOM_INDEXER_BASE_URL` is non-secret).
- **`README.md` secret grep**  `[FIXED]` — dropped the meaningless `<your-secret>`
  arm; now references `npm run check:assets` and grepping the **whole**
  `dist/client` tree.
- **`HANDOFF.md`**  `[FIXED]` — test-coverage status refreshed; corrected the
  claim that `nom-indexer.d.ts` is gitignored (it is simply uncommitted).
- **`src/shared/format/amount.ts`**  `[FIXED]` — `parseAmount` JSDoc now states it
  is currently unused (read-only explorer).
- **`PEER_REVIEW.md` / `PEER_REVIEW_SPEC.md`**  `[FIXED]` — restored (this file
  refreshed; the spec restored unchanged), clearing the dead references.

---

## Test Coverage

### Now (this pass)
- `vitest.workspace.ts` defines a jsdom `unit` project and a node `worker` project
  (with a Cache API polyfill in `tests/worker/setup.ts`); `npm run test:worker`
  resolves. **77 tests** total.
- Shared: `amount`, `money` (incl. edge branches), `time`, `address.truncateMiddle`,
  `price-aliases`, `identifier` (incl. edges + length pinning), `direction`.
- Worker: `respond` (envelope shaping + no-leak `errorFromThrown`), `errors`
  (`mapUpstreamStatus` table), `jwt` (minting + **secret-non-leak** assertion),
  `upstream.parseRetryAfter`, `address` clamp helpers (the max-200 contract),
  `search` dispatch (mocked upstream), `address` routes (collection-vs-array,
  precision-string passthrough, `getToken` failure isolation), `cache` read-through.

- **Playwright e2e**  `[ADDED]` — `playwright.config.ts` + `e2e/smoke.spec.ts`
  (5 specs): home (single search box), search dispatch to `/address` and `/tx`
  (0x stripped/lowercased), address tab-hash survival across reload, and a
  **network-isolation** assertion that the browser makes no cross-origin request
  and carries no `Authorization` header (proving the two-tier boundary at the
  browser layer). `npm run test:e2e` passes.

### Still recommended
- Optionally migrate the `worker` project to the full
  `@cloudflare/vitest-pool-workers` pool for real `caches`/`ExecutionContext`
  semantics (currently a lightweight polyfill).

---

## Pre-deploy checklist

- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass
- [ ] `npm run check:assets` prints ✅ (run automatically by `deploy:production`)
- [ ] Resolve the `deploy:production --env production` redirect incompatibility
      (select the env via the Vite plugin) and set the real `NOM_INDEXER_BASE_URL`
      (Open Question #1)
- [ ] Decide Open Question #6 (fiat price source) and record it in the spec
- [ ] If any artifact containing `NOM_INDEXER_JWT_SECRET` was ever deployed/shared,
      rotate the secret with the indexer team
