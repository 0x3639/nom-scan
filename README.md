# NoM Scan

A Zenon Network block explorer (search, address pages, transaction details). Built as a Cloudflare-hosted React SPA with a Cloudflare Worker that proxies authenticated requests to `nom-indexer-go`. See [`PFSCAN_SPEC.md`](./PFSCAN_SPEC.md) for the original product spec (the codebase was rebranded from "PFScan" to "NoM Scan"; the spec filename and internal identifiers like `pfscanFetch`/`PFScanResponse` were kept for stability) and [`CLAUDE.md`](./CLAUDE.md) for the architectural cheat sheet.

## Local development

**Prerequisite:** a running local instance of [`nom-indexer-go`](https://www.0x3639.com/nom-indexer-go/api/) on `http://localhost:8080`.

1. Copy `.dev.vars.example` to `.dev.vars` and fill in:
   - `NOM_INDEXER_BASE_URL` — defaults to `http://localhost:8080`.
   - `NOM_INDEXER_JWT_SECRET` — HMAC-SHA256 signing secret your local indexer uses to validate JWTs. The Worker mints short-lived (5-minute) JWTs from this on each upstream call.
   - Optional: `NOM_INDEXER_JWT` to use a pre-minted long-lived JWT instead.
2. Install: `npm install`
3. Run: `npm run dev` (Vite + Worker via `@cloudflare/vite-plugin`)
4. Open <http://localhost:5173>

The Worker authenticates to upstream automatically — the browser never sees the JWT or the signing secret.

## Environments

| Env | Indexer URL | Secret source | Command |
|---|---|---|---|
| `local` | `http://localhost:8080` (overridable in `.dev.vars`) | `.dev.vars` (gitignored) | `npm run dev` |
| `production` | configured in `wrangler.jsonc → env.production.vars` | `wrangler secret put NOM_INDEXER_JWT_SECRET --env production` | `npm run deploy:production` |

The Worker reads the same env var names regardless of environment — selection happens at deploy time, not in code.

## Scripts

- `npm run dev` — local dev server (Vite + Worker)
- `npm run build` — production build to `dist/`
- `npm run typecheck` — TypeScript type check
- `npm run test` — Vitest unit tests
- `npm run test:e2e` — Playwright browser tests
- `npm run codegen:api` — regenerate nom-indexer types from the OpenAPI spec
- `npm run deploy:production` — deploy to Cloudflare (production env)

## Security

The browser bundle must never contain the upstream JWT or signing secret. Verify after every release:

```sh
npm run build && grep -rE "NOM_INDEXER_JWT|Bearer\s+eyJ|<your-secret>" dist/client/client/
```

The grep should return nothing.
