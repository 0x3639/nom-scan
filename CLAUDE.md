# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This repository is pre-implementation. The only file is `PFSCAN_SPEC.md`, a detailed product spec for **PFScan** — a Zenon Network block explorer modeled on Blockscan's information architecture with Zenon Tools' visual language. There is no source code, build tooling, package manifest, or git history yet. Read `PFSCAN_SPEC.md` end-to-end before writing code; the rest of this file summarizes load-bearing decisions so they aren't lost or contradicted.

## Architecture (as specified, not yet built)

**Frontend:** React + TypeScript + Vite SPA. React Router for routes, TanStack Query for fetching/caching, lucide-react for icons. CSS variables for theme tokens. BigInt-safe helpers for all `Amount` values.

**Hosting:** Cloudflare Workers with Static Assets (or Pages + Functions). The Worker serves the SPA and acts as an API proxy.

**Storage:** D1 for users/sessions/saved addresses/groups/labels; KV or Cache API for token metadata and short-lived response cache.

**Two-tier API model — this is non-negotiable:**
- The React app calls a **PFScan Worker API** (e.g. `/api/address/:address/summary`, `/api/tx/:hash`, `/api/search`).
- The Worker calls **nom-indexer-go** (`/api/v1/*`) with a Bearer JWT held as a Worker secret (`NOM_INDEXER_JWT`, `NOM_INDEXER_BASE_URL`).
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

## MVP Scope Boundaries

In-scope per spec: search, address portfolio, address transactions, transaction detail, email/passkey login, saved addresses with private labels and groups.

Explicitly out of scope for MVP — do not build these unless asked:
- Multi-chain support, Blockscan Chat, advanced analytics dashboards.
- Token/pillar/project/momentum global search.
- Fiat portfolio valuation (no approved price source yet — show `N/A` or hide the column).
- Wallet-based auth.

## Open Questions

The spec ends with six unresolved questions (production indexer URL, www domain handling, login method, light mode in MVP, paired send/receive stitching, price source). Surface these to the user before making decisions that depend on them rather than guessing.

## Commands

No build/test/lint commands exist yet — the project hasn't been scaffolded. Once Phase 1 begins (React + TS + Vite + Cloudflare Worker), update this section with the actual commands.
