# NoM Scan

**Live:** <https://nom-scan.0x3639.workers.dev>

A Zenon Network block explorer (search, address pages, transaction details). Built as a Cloudflare-hosted React SPA with a Cloudflare Worker that proxies authenticated requests to `nom-indexer-go`. See [`docs/NOMSCAN_SPEC.md`](./docs/NOMSCAN_SPEC.md) for the product spec (originally written as "PFScan"; the project was fully renamed to "NoM Scan" / `nomscan`) and [`CLAUDE.md`](./CLAUDE.md) for the architectural cheat sheet. Project docs (spec, handoff, peer review) live in [`docs/`](./docs).

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
| `production` | `https://indexerapi.zenon.info` (`wrangler.jsonc → env.production.vars`) | `wrangler secret put NOM_INDEXER_JWT_SECRET --env production` | `npm run deploy:production` |

The Worker reads the same env var names regardless of environment — selection happens at deploy time, not in code.

**Run local dev against the production indexer:** in `.dev.vars`, set
`NOM_INDEXER_BASE_URL=https://indexerapi.zenon.info` and set `NOM_INDEXER_JWT_SECRET`
to the **production** signing secret (the production indexer only accepts JWTs minted
with that secret, under the `nomscan` subject). See `.dev.vars.example`.

## Deploying to Cloudflare

### Automatic deploys (Cloudflare Workers Builds)

Deploys are driven by **Cloudflare Workers Builds** (the Git integration set up in
the Cloudflare dashboard), not GitHub Actions. Cloudflare watches the connected repo
and builds/deploys on push to the production branch. No GitHub-side secrets or API
token are needed.

Required dashboard configuration (Worker → Settings → Build):

- **Git repository:** `0x3639/nom-scan`, production branch `main` (reconnect if it
  shows "disconnected").
- **Build command:** `npm run build`
- **Build variable** `CLOUDFLARE_ENV=production` — **critical.** The Worker uses a
  Wrangler environment (`env.production`) selected at build time by
  `@cloudflare/vite-plugin`. Without this, the build targets the top-level/local
  default and ships a Worker with no `NOM_INDEXER_BASE_URL` and the wrong name.
- **Deploy command:** `npx wrangler deploy` (no `--env` — the env is baked in at build).

`NOM_INDEXER_JWT_SECRET` is stored on the Worker itself (set once via
`wrangler secret put`), so the build never handles it and it is preserved across
deploys. The other production vars (`NOM_INDEXER_BASE_URL`, `NOM_INDEXER_JWT_SUBJECT`,
`NOMSCAN_ENV`) come from `wrangler.jsonc → env.production.vars` and overwrite any
dashboard-set plaintext vars on each deploy.

### Manual / first-time setup

1. **Authenticate:** `npx wrangler login` (interactive browser auth).
2. **Set the production signing secret** (the HMAC secret the production indexer validates JWTs against), on the production Worker:
   ```sh
   npx wrangler secret put NOM_INDEXER_JWT_SECRET --env production
   ```
3. **Deploy:** `npm run deploy:production` — builds for the production env
   (`CLOUDFLARE_ENV=production vite build`), runs the secret-leak asset guard, then
   `wrangler deploy`. (The env is selected at build time by `@cloudflare/vite-plugin`,
   not via `wrangler deploy --env`.)

This deploys the Worker named `nom-scan` to your `*.workers.dev` subdomain (no custom
domain configured yet). The production indexer URL (`https://indexerapi.zenon.info`)
and the JWT subject (`nomscan`) live in `wrangler.jsonc → env.production.vars`.

> **Indexer prerequisite:** the production indexer must accept JWTs with the
> `nomscan` subject (it rate-limits 60 req/min per subject). Coordinate the
> signing secret + accepted subject with the indexer operator before deploying.
>
> **Worker name:** the signing secret must be set on the same Worker that gets
> deployed (`nom-scan`). If you set it earlier under a different name, re-run
> `wrangler secret put` so it lands on `nom-scan`.

To add a custom domain later, add a `routes` block under `env.production` in
`wrangler.jsonc` and point DNS at Cloudflare.

## Scripts

- `npm run dev` — local dev server (Vite + Worker)
- `npm run build` — production build to `dist/`
- `npm run typecheck` — TypeScript type check
- `npm run test` — Vitest unit tests
- `npm run test:e2e` — Playwright browser tests
- `npm run codegen:api` — regenerate nom-indexer types from the OpenAPI spec
- `npm run deploy:production` — deploy to Cloudflare (production env)

## Security

The browser bundle must never contain the upstream JWT or signing secret, and no
secret may be served as a static asset. `npm run deploy:production` runs
`npm run check:assets` (see `scripts/check-deploy-assets.mjs`) before publishing,
which scans the served asset tree for `NOM_INDEXER_*` secrets, the literal
`.dev.vars` value, and Worker artifacts — and fails the deploy if any are found.

Verify manually after a build (scan the **whole** `dist/client` tree, not just
`client/`, since the Worker output dir is a sibling):

```sh
npm run build && npm run check:assets
# or, ad hoc, grep for the real local secret value too:
npm run build && grep -rIE "NOM_INDEXER_JWT_SECRET|Bearer\s+eyJ" dist/client/
```

`check:assets` should print a ✅ and the grep should return nothing.
