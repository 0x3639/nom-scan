# PFScan Peer Review

## Summary

Ship with fixes. The core architecture is sound: React only calls the PFScan Worker API, the Worker owns nom-indexer-go auth, `npm run typecheck` and `npm run build` pass, and the built client bundle did not contain `NOM_INDEXER`, `Bearer eyJ`, or the local signing secret. I found no critical security leaks, but there were several correctness/accessibility/tooling issues worth fixing before calling Phases 1/2 merged.

Follow-up status: the concrete Medium and Low / Nit implementation findings below have been fixed in the working tree. The only remaining item is the open JWT-scope question for the upstream auth contract.

Verification run:

- `npm run typecheck` passed.
- `npm run build` passed.
- `grep -rE "NOM_INDEXER|Bearer\s+eyJ" dist/client/client/` returned no matches.
- Grep for the literal local `NOM_INDEXER_JWT_SECRET` value in `dist/client/client/` returned no matches.
- `npm run lint` passed after adding an ESLint flat config.
- `npm test` passed after adding focused unit tests.
- Local dev server starts at `http://127.0.0.1:5173/` when run with elevated sandbox permissions. A homepage HEAD request returned 200, and `/api/prices` returned a valid PFScan envelope.

## Critical

None.

## High

None.

## Medium

### Top nav never reads the actual status height

- **File:** `src/app/layout/TopNav.tsx:8`
- **Issue:** The status schema exposes `latest_height`, but `TopNav` only reads `momentum_height` and `height`.
- **Impact:** The spec calls for current momentum height in the global shell, but production status responses from nom-indexer-go will leave the badge hidden.
- **Suggested fix:** Read `latest_height` first, then keep the existing fallback fields if desired:
  `["latest_height"] ?? ["momentum_height"] ?? ["height"]`.

### Empty price-feed success can keep stale prices alive indefinitely

- **File:** `src/worker/routes/prices.ts:17`
- **Issue:** `fetchUpstreamPrices()` returns `{}` for a successful upstream response with no usable prices. Later, `if (upstream)` treats that empty object as fresh data and refreshes the last-known-good cache at lines 86-87.
- **Impact:** If `api.zenon.info/price` starts returning `{"data": {}}`, PFScan will keep serving old prices and extend their 5-minute TTL forever, hiding the feed failure.
- **Suggested fix:** Treat an empty parsed price map as `null`, or gate the last-known refresh on `Object.keys(upstream).length > 0`.

### Search route drops upstream error semantics

- **File:** `src/worker/routes/search.ts:54`
- **Issue:** Non-404 `UpstreamError`s are returned as `code: "upstream_error"` for every status, with the upstream status copied into the response.
- **Impact:** Search-specific 401/403, 429, and 503 responses lose the shared mappings and `Retry-After` behavior used by other routes. A rate-limited search becomes an "Indexer error" in the UI instead of a retryable rate-limit state.
- **Suggested fix:** Reuse `errorFromThrown(e)` for `UpstreamError`, or call `mapUpstreamStatus` and preserve `retryAfterSeconds` in `err()`.

### Search inputs duplicate DOM ids and shortcut listeners

- **File:** `src/app/components/SearchInput.tsx:59`
- **Issue:** Every `SearchInput` renders `id="pfscan-search"` and installs a global `/` key listener. On the home page, both the top-nav search and hero search are mounted.
- **Impact:** Duplicate ids break label/input association, and pressing `/` can fire multiple handlers with focus ending on whichever instance runs last. This is an accessibility and UX bug.
- **Suggested fix:** Generate ids with `useId()` or accept an `id` prop. Add an `enableShortcut` or `shortcutPriority` prop so only one mounted search box owns the global `/` shortcut.

### Tabs use ARIA tab roles without keyboard navigation

- **File:** `src/app/components/address/AddressTabs.tsx:17`
- **Issue:** Inactive tabs have `tabIndex={-1}`, but there are no ArrowLeft/ArrowRight/Home/End handlers to move focus between tabs.
- **Impact:** Keyboard users can tab to the active tab only and cannot reach the inactive tab through standard tab navigation. That violates the expected behavior once `role="tablist"`/`role="tab"` is used.
- **Suggested fix:** Either implement roving-focus keyboard handling for the tablist, or remove the ARIA tab roles and keep both buttons normally tabbable.

## Low / Nit

### Lint script is currently unusable

- **File:** `package.json:12`
- **Issue:** `npm run lint` invokes ESLint 9, but the repo has no `eslint.config.js`.
- **Impact:** Contributors and CI cannot run the advertised lint check.
- **Suggested fix:** Add an ESLint flat config for TypeScript/React, or remove the script until the config exists.

### Test script fails because the suite is empty

- **File:** `package.json:13`
- **Issue:** `npm test` exits with code 1 because Vitest finds no test files.
- **Impact:** Any CI job that runs `npm test` will fail even though the lack of tests is currently expected.
- **Suggested fix:** Add the first focused unit tests from the peer-review brief, or configure the script/CI to tolerate an empty suite until tests are committed.

### Architecture note is stale

- **File:** `CLAUDE.md:7`
- **Issue:** The file still says the repo is pre-implementation, has only `PFSCAN_SPEC.md`, and has no build/test/lint commands.
- **Impact:** Future agents or reviewers may follow outdated guidance and miss the current React/Worker implementation.
- **Suggested fix:** Update `CLAUDE.md` to describe the current Phase 1/2 implementation and the real command set.

### Activity bounds duplicate timestamp fallback logic

- **File:** `src/app/api/queries.ts:108`
- **Issue:** `useAddressActivityBounds` reads `momentum_timestamp ?? timestamp` directly instead of using the shared `txTimestamp(tx)` helper.
- **Impact:** Minor consistency drift; if timestamp compatibility changes, this code path can diverge from transaction table/detail behavior.
- **Suggested fix:** Import and use `txTimestamp(oldestRow)` / `txTimestamp(newestRow)`.

## What looks good

- The Worker boundary is clean: all nom-indexer-go calls go through Worker routes, and no upstream JWT or secret was found in the production client bundle.
- `respond.ts` and the route handlers mostly honor the shared `{ ok, data }` / `{ ok: false, error }` envelope.
- Path params used in upstream nom-indexer-go URLs are encoded with `encodeURIComponent`.
- No `dangerouslySetInnerHTML` or raw HTML rendering paths were found. Transaction `data` and decoded input render as React text inside `<pre>`.
- Amount formatting stays BigInt/string-based for chain amounts; lossy `Number()` conversion is isolated to USD display math.
- Theme tokens match the `tools.zenon.info` direction closely, including Montserrat, dark surfaces, green primary actions, and the requested 1240px content width.
- TanStack Query usage is straightforward, and token metadata fetching is deduped by query key rather than per-row fetches.

## Open questions for the implementer

1. Should minted nom-indexer-go JWTs include a `scope: "read"` claim? The OpenAPI description and CLI examples mention scoped tokens, while `src/worker/jwt.ts` currently mints only `sub`, `iat`, and `exp`.
