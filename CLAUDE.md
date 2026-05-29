# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This repository now contains the Phase 1/2 implementation for **NoM Scan** (originally named "PFScan" — the display name was rebranded but technical identifiers like `pfscanFetch`, `PFScanResponse`, the `pfscan-local` Worker name, the npm package name, and the `PFSCAN_SPEC.md` / `PFSCAN_ENV` references were intentionally kept stable). It is a React + Cloudflare Worker Zenon Network explorer modeled on Blockscan's information architecture with Zenon Tools' visual language. `docs/PFSCAN_SPEC.md` remains the product source of truth, and `docs/PEER_REVIEW.md` records the latest senior-review findings and verification notes. (Project docs live in `docs/`; `README.md` and this file stay in the repo root.)

Implemented scope: scaffold, Worker proxy, shared API/types, dark theme tokens, home/search, address portfolio, address transactions, transaction detail, loading/empty/error states, price-feed valuation, and focused unit tests.

Phase 3 auth/D1/watchlist work is not implemented yet. `/login`, `/account`, and `/account/watchlist` are intentional "Coming soon" stubs.

## Architecture

**Frontend:** React + TypeScript + Vite SPA. React Router for routes, TanStack Query for fetching/caching, lucide-react for icons. CSS variables for theme tokens. BigInt-safe helpers for all `Amount` values.

**Hosting:** Cloudflare Worker with Static Assets via `@cloudflare/vite-plugin`. The Worker serves the SPA and acts as an API proxy.

**Storage:** No persistent NoM Scan storage yet. Future Phase 3 work should add D1 for users/sessions/saved addresses/groups/labels and KV/Cache API where useful.

**Two-tier API model — this is non-negotiable:**
- The React app calls a **NoM Scan Worker API** (e.g. `/api/address/:address/summary`, `/api/tx/:hash`, `/api/search`).
- The Worker calls **nom-indexer-go** (`/api/v1/*`) with a Bearer JWT. The default path **mints** short-lived (5-min) HS256 JWTs from `NOM_INDEXER_JWT_SECRET` (a Worker secret); `NOM_INDEXER_JWT` is an optional pre-minted fallback. `NOM_INDEXER_BASE_URL` is the non-secret upstream URL and `NOM_INDEXER_JWT_SUBJECT` (default `pfscan`) is the subject claim. See `src/worker/jwt.ts`.
- The frontend must **never** call nom-indexer-go directly and the JWT must never appear in the browser bundle, network tab, or page source. This is in the acceptance criteria.

**nom-indexer-go contract facts that affect code:**
- Collection endpoints return `{ data, pagination }`; single-object endpoints return the object directly.
- Amounts are JSON **strings** (to avoid JS integer precision loss) — pass them through as strings to the client and format with BigInt helpers; never `Number()` them.
- Pagination: `page` + `page_size`, default 50, max 200 (Worker must clamp).
- Rate limit: 60 req/min per JWT subject.
- OpenAPI lives at https://www.0x3639.com/nom-indexer-go/api/openapi.yaml.

## Routing & URL Conventions

- `/address/:address` defaults to portfolio; tab state lives in the **URL hash** (`#portfolios`, `#transactions`) and must survive refresh / direct link.
- Public transaction route is `/tx/:hash` even though the underlying object is an `account_block` — match Blockscan URL shape, but label the object as "Account Block" inside the UI where helpful.
- Search dispatch: `z1…` → address route; 64 hex chars (optional `0x` prefix stripped) → tx route; ambiguous → Worker `/api/search` which tries `/api/v1/accounts/{q}` then `/api/v1/account_blocks/{q}`.

## Visual Design Constraints

Dark-first theme matching `tools.zenon.info`. Theme tokens are enumerated in the spec (`--color-bg: #151515`, primary green `#3f6036`, etc.) — use those CSS variables verbatim so the theme can evolve in one place. Montserrat with `.02em` letter-spacing; monospace for addresses/hashes. Max content width 1180–1280px. No oversized hero typography on detail pages — community-utility tone, not marketing.

Do **not** reuse Blockscan brand assets, logos, copy, or icons (explicit non-goal).

## Scope Boundaries

Current implemented scope: public explorer pages and the Worker proxy. Phase 3 will add email/passkey login, saved addresses, private labels, groups, and D1-backed account features.

Do not build these unless asked:
- Multi-chain support, Blockscan Chat, advanced analytics dashboards.
- Token/pillar/project/momentum global search.
- Wallet-based auth.

## Open Questions

The spec ends with six unresolved questions (production indexer URL, www domain handling, login method, light mode in MVP, paired send/receive stitching, price source). Surface these to the user before making decisions that depend on them rather than guessing.

## Commands

- `npm run dev` — local Vite + Cloudflare Worker dev server.
- `npm run typecheck` — TypeScript project-reference check.
- `npm run build` — production client + Worker build.
- `npm run lint` — ESLint flat-config check.
- `npm test` — Vitest unit tests.
- `npm run deploy:production` — build and deploy with the production Wrangler environment.
