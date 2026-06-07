# NomScan Product Spec

NomScan is a Zenon Network explorer inspired by Blockscan's simple search, address, portfolio, and transaction workflows. The product name means Proof Scan and the public domain should be `nomscan.com`.

The goal is a Zenon-native Blockscan experience: same core information architecture and dense explorer ergonomics, but with NomScan branding, Zenon data, and a visual language aligned with Zenon Tools.

## References

- Blockscan home: https://blockscan.com/
- Blockscan address reference: https://blockscan.com/address/0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97
- Blockscan address portfolio tab: https://blockscan.com/address/0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97#portfolios
- Blockscan address transactions tab: https://blockscan.com/address/0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97#transactions
- Blockscan transaction reference: https://blockscan.com/tx/0x5dabb6117268bbb1b818f60b51ee9bd741a0e1e07b9f15af9570c1927db3c53e
- nom-indexer-go API docs: https://www.0x3639.com/nom-indexer-go/api/
- nom-indexer-go OpenAPI: https://www.0x3639.com/nom-indexer-go/api/openapi.yaml
- Zenon Tools theme/content reference: https://tools.zenon.info/
- Cloudflare React/Workers reference: https://developers.cloudflare.com/workers/framework-guides/web-apps/react/
- Cloudflare static assets reference: https://developers.cloudflare.com/workers/static-assets/

## Product Goals

1. Let anyone search a Zenon address or account-block hash from the home page.
2. Make address and transaction pages feel structurally familiar to Blockscan users.
3. Keep the first version simple: search, address portfolio, address transactions, transaction details, user login, and saved user features.
4. Build on `nom-indexer-go` through a Cloudflare-hosted React app and Worker API proxy.
5. Preserve a clean Zenon Tools feel: practical, table-friendly, lightweight, community-tool energy.

## Non-Goals For MVP

- No full multi-chain explorer.
- No Blockscan Chat equivalent.
- No advanced analytics dashboards.
- No token, pillar, project, or momentum search from the global search box until the address/hash experience is polished.
- No fiat portfolio valuation unless a separate trusted price source is added.
- No exact reuse of Blockscan brand assets, logos, copy, icons, or proprietary UI artwork.

## Users

- Zenon holders checking balances, account activity, and received/sent transfers.
- Community members sharing address or transaction links.
- Power users who want saved addresses, local labels, and later custom alerts.
- Developers verifying account-block hashes and decoded method/input data.

## Information Architecture

### Routes

- `/`
  Home search page.
- `/address/:address`
  Address page, defaulting to the portfolio section.
- `/address/:address#portfolios`
  Address page with Portfolio tab active.
- `/address/:address#transactions`
  Address page with Transactions tab active.
- `/tx/:hash`
  Transaction/account-block detail page.
- `/login`
  Login/register entry point.
- `/account`
  Logged-in user dashboard.
- `/account/watchlist`
  Saved addresses and custom labels.

Future routes can add `/token/:tokenStandard`, `/momentum/:height`, `/pillars`, and `/projects`.

## Core UX

### Global Shell

Use a compact explorer shell on every page:

- Top nav with NomScan logo, `Explorer`, optional `Tools`, search input, theme toggle, and login/account button.
- Search input should remain available globally, not just on the home page.
- Show current momentum height when available from `/api/v1/status` or `/api/v1/momentums/latest`.
- Footer should stay minimal: NomScan, Zenon Network links, GitHub/community links, terms/privacy once needed.

### Home Page

Blockscan-inspired structure:

- Centered brand/title area.
- Main headline: `NomScan`
- Supporting line: `Zenon Explorer | Portfolio | Transactions`
- Large search bar with placeholder `Search by Address or Hash`.
- Small command hint for `/` keyboard focus.
- Lightweight quick links below search, such as `Recent Transactions`, `Tokens`, `Pillars`, and `Zenon Tools`, but only link to implemented pages.
- Logged-in users may see a small `My Watchlist`/`My Groups` entry, matching Blockscan's "group list" idea without overbuilding it.

### Search Behavior

On submit:

1. Trim whitespace and normalize casing only where safe.
2. If the query looks like a Zenon address, route to `/address/:address#portfolios`.
3. If the query looks like an account-block hash, route to `/tx/:hash`.
4. If the type is ambiguous, call the NomScan Worker search endpoint, which should try:
   - `GET /api/v1/accounts/{query}`
   - `GET /api/v1/account_blocks/{query}`
5. If neither resolves, show a compact not-found state with the original query and suggestions.

Initial validation can be intentionally permissive:

- Address: starts with `z1` and contains Bech32-compatible lowercase characters.
- Hash: 64 hex characters, with optional `0x` accepted and stripped only for lookup if Zenon data uses non-prefixed hashes.

Do not add global full-text search until there is a proper index/API endpoint.

## Address Page

The address page should mirror Blockscan's page anatomy: header, summary, tabs, active tab content, dense data tables.

### Header

Desktop:

- Title: `Address`
- Full address in monospace.
- Copy button.
- QR button/modal.
- Optional external links.
- Logged-in actions: `Save`, `Add Label`, `Add to Group`.

Mobile:

- Title and truncated address.
- Copy/QR/Save buttons as icons with tooltips.
- Full address available via tap/copy area.

### Summary Region

Use compact cards or label/value blocks, not large marketing cards.

Fields:

- Current ZNN balance.
- Current QSR balance.
- Other token count.
- Total account-block count.
- First active timestamp.
- Last active timestamp.
- Delegate, if present.
- Lifetime ZNN sent/received.
- Lifetime QSR sent/received.

API sources:

- `GET /api/v1/accounts/{address}`
- `GET /api/v1/accounts/{address}/balances`
- Token metadata from `GET /api/v1/tokens/{token_standard}` as needed.

### Tabs

Use URL hash state:

- `Portfolio`
- `Transactions`

The active tab must survive refresh and direct links.

### Portfolio Tab

Primary table columns:

- Token
- Symbol
- Balance
- Token Standard
- Last Updated

Optional sections below the token table:

- Active stakes from `GET /api/v1/accounts/{address}/stakes`
- Active plasma fusions from `GET /api/v1/accounts/{address}/fusions`
- Cumulative rewards from `GET /api/v1/accounts/{address}/rewards/cumulative`
- Bridge wraps/unwraps from:
  - `GET /api/v1/accounts/{address}/bridge/wraps`
  - `GET /api/v1/accounts/{address}/bridge/unwraps`

For MVP, do not show a fiat "Portfolio Value" total unless a price source is integrated. If the layout needs a value column for Blockscan parity, display `N/A` or hide the column behind a feature flag.

### Transactions Tab

Primary table columns:

- Hash
- Type / Method
- Age
- From
- To
- Direction
- Amount
- Token
- Momentum

API source:

- `GET /api/v1/accounts/{address}/transactions?page=1&page_size=25&sort=desc`

Behavior:

- Default page size: 25.
- Pagination controls: Previous/Next plus current page.
- Direction badge rules:
  - `OUT` when `address` equals the viewed address and `to_address` differs.
  - `IN` when `to_address` equals the viewed address and `address` differs.
  - `SELF` when both match.
  - `RECEIVE` or `PAIR` when the block is a receive account-block paired to a send.
- Hash, from, to, and token standards are clickable.
- Method/input data should be shown as a compact badge if `method` exists.

Mobile:

- Convert rows into stacked transaction list items.
- Keep hash, direction, amount, token, and age visible first.
- Put momentum and method in secondary metadata.

## Transaction Page

The public route should be `/tx/:hash`, even though the API object is an account-block. This matches explorer expectations and the Blockscan URL pattern.

### Header

- Title: `Transaction Details`
- Hash in monospace.
- Copy button.
- Status badge: `Confirmed` when the account-block exists.

### Details Layout

Use a two-column label/value table on desktop and a single stacked table on mobile.

Fields:

- Transaction Hash
- Status
- Block Type
- Method
- Momentum Height
- Momentum Hash
- Timestamp
- From
- To
- Amount
- Token
- Paired Account Block
- Descendant Of
- Data
- Decoded Input

API source:

- `GET /api/v1/account_blocks/{hash}`

Important Zenon-specific language:

- Label the underlying object as `Account Block` where helpful.
- Use `Transaction` in the route/title for user familiarity.
- If `paired_account_block` exists, link to `/tx/:pairedHash`.
- Show `No gas fee` or omit fee fields unless nom-indexer-go exposes a meaningful fee/plasma field.

## Data Integration

### nom-indexer-go API Facts

The OpenAPI contract documents:

- API version: OpenAPI 3.1, app version `0.1.0`.
- Current protected endpoints live under `/api/v1/`.
- `/healthz` and `/readyz` do not require a token.
- `/api/v1/*` requires a Bearer JWT.
- JWTs are admin-minted; there is no public token-mint endpoint.
- Collection endpoints return `{ data, pagination }`.
- Single-object endpoints return the object directly.
- Amounts are JSON strings to avoid JavaScript integer precision loss.
- Collection pagination uses `page` and `page_size`, default page size 50, maximum 200.
- Documented rate limit is 60 requests/minute per JWT subject.

### Required MVP API Calls

Public status:

- `GET /api/v1/status`
- `GET /api/v1/momentums/latest`

Address:

- `GET /api/v1/accounts/{address}`
- `GET /api/v1/accounts/{address}/balances`
- `GET /api/v1/accounts/{address}/transactions`

Transaction:

- `GET /api/v1/account_blocks/{hash}`

Token enrichment:

- `GET /api/v1/tokens/{token_standard}`
- Optionally `GET /api/v1/tokens` for cache warming.

User portfolio enhancements:

- `GET /api/v1/accounts/{address}/stakes`
- `GET /api/v1/accounts/{address}/fusions`
- `GET /api/v1/accounts/{address}/rewards`
- `GET /api/v1/accounts/{address}/rewards/cumulative`
- `GET /api/v1/accounts/{address}/bridge/wraps`
- `GET /api/v1/accounts/{address}/bridge/unwraps`

### NomScan Worker API

The React app must not call nom-indexer-go directly with the protected JWT. Use a Cloudflare Worker/Pages Function as a thin API layer.

Suggested NomScan API:

- `GET /api/status`
- `GET /api/search?q=...`
- `GET /api/address/:address/summary`
- `GET /api/address/:address/balances`
- `GET /api/address/:address/transactions?page=&page_size=&sort=`
- `GET /api/tx/:hash`
- `GET /api/tokens/:tokenStandard`
- `POST /api/account/watchlist`
- `GET /api/account/watchlist`
- `PATCH /api/account/watchlist/:id`
- `DELETE /api/account/watchlist/:id`

Worker responsibilities:

- Store `NOM_INDEXER_BASE_URL` and `NOM_INDEXER_JWT` as secrets/env vars.
- Add `Authorization: Bearer <token>` to upstream requests.
- Normalize upstream problem+json errors into UI-friendly responses.
- Cache token metadata aggressively.
- Cache status/latest momentum briefly.
- Clamp page sizes to the API max of 200.
- Convert no amounts to JavaScript numbers; pass strings to the client.

## Architecture

### Frontend

- React + TypeScript + Vite.
- React Router for routes.
- TanStack Query or equivalent for API fetching/caching.
- CSS variables for theme tokens; Tailwind or plain CSS modules are both acceptable.
- lucide-react for icons in buttons and controls.
- BigInt-safe formatting helpers for all `Amount` strings.

### Hosting

Recommended Cloudflare setup:

- Cloudflare Workers with Static Assets or Cloudflare Pages + Functions.
- Use the Cloudflare Vite flow for a React SPA plus API Worker.
- Static assets served from Cloudflare edge.
- Worker handles API proxy, auth/session endpoints, and SPA fallback.

### Storage

- Cloudflare D1 for users, sessions, saved addresses, groups, labels, and alert definitions.
- Cloudflare KV or Cache API for token metadata and short-lived API response cache.
- Optional Durable Object later for live stream coordination if NomScan consumes nom-indexer-go WebSockets.

### Suggested D1 Tables

`users`

- `id`
- `email`
- `display_name`
- `created_at`
- `updated_at`

`sessions`

- `id`
- `user_id`
- `expires_at`
- `created_at`

`saved_addresses`

- `id`
- `user_id`
- `address`
- `label`
- `notes`
- `created_at`
- `updated_at`

`address_groups`

- `id`
- `user_id`
- `name`
- `created_at`
- `updated_at`

`address_group_members`

- `group_id`
- `saved_address_id`

`user_settings`

- `user_id`
- `theme`
- `timezone`
- `default_address_tab`

## Authentication

MVP login should support email-based login or passkeys. Keep wallet login as a later enhancement unless a reliable Zenon wallet auth flow is chosen.

Requirements:

- Explorer pages are public and do not require login.
- Login unlocks saved addresses, labels, groups, and future alerts.
- Sessions use secure, HTTP-only cookies.
- Cookies must be `Secure`, `HttpOnly`, and `SameSite=Lax`.
- Auth endpoints must be rate-limited.
- User labels are private by default.

Initial custom features:

- Save address.
- Add private label.
- Group saved addresses.
- Default landing tab preference.
- Recent searches for logged-in users.

Future custom features:

- Address alerts.
- Transaction notes.
- Shared public labels.
- Group portfolio view.
- CSV export.

## Visual Design

### Design Direction

Blend Blockscan's explorer layout with Zenon Tools' lightweight community utility feel.

Blockscan cues:

- Centered home search.
- Compact top navigation.
- Search-first interaction model.
- Address page with tabs for portfolio and transactions.
- Dense transaction and portfolio tables.
- Copy buttons, badges, labels, and muted metadata.

Zenon Tools cues from `https://tools.zenon.info/`:

- Dark-first interface with `#151515` page background.
- Montserrat typography with slightly expanded letter spacing.
- Clear nav links.
- Current momentum height surfaced near the top.
- Rounded dark tables with alternating rows and subtle green-tinted borders.
- Dark inputs using `#292929`, hover/focus states using `#353535`.
- Green primary buttons in the `#3f6036` family.
- Practical tables over decorative panels.
- Low-noise page structure.
- Community-project tone.

### Theme Tokens

Use CSS variables so the theme can evolve. NomScan should default to a dark theme matching `tools.zenon.info`; a light theme can be added later as an accessibility/user preference option.

Default dark theme:

- `--color-bg: #151515`
- `--color-surface: #1b1b1b`
- `--color-surface-alt: #1f1f1f`
- `--color-surface-raised: #292929`
- `--color-surface-hover: #353535`
- `--color-border: #e5ffe814`
- `--color-text: #ffffff`
- `--color-muted: #ffffffb3`
- `--color-subtle: #ffffff80`
- `--color-primary: #3f6036`
- `--color-primary-hover: #48743c`
- `--color-success: #6cef4b`
- `--color-warning: #ff7e45`
- `--color-danger: #ff4b4b`
- `--shadow-soft: 0 0 .8em #00000040`

Typography:

- Prefer `Montserrat`, `system-ui`, `-apple-system`, `Segoe UI`, sans-serif.
- Use `font-weight: 700` sparingly for table headers, buttons, labels, and important amounts.
- Use slight positive letter spacing, around `.02em`, to echo Zenon Tools.
- Use a monospace stack for addresses and hashes.
- Do not use oversized hero typography inside explorer detail pages.

Layout:

- Max content width: 1180-1280px.
- Cards and controls: 6-8px radius, matching the rounded but compact Zenon Tools controls.
- Tables: compact row height, rounded outer container, alternating dark rows, sticky header where useful.
- Buttons: icon-first when action is familiar, with accessible labels/tooltips.

## Responsive Requirements

Breakpoints:

- Mobile: `< 640px`
- Tablet: `640px - 1024px`
- Desktop: `> 1024px`

Mobile rules:

- No horizontal page overflow.
- Header collapses to logo, search icon/input, account icon, and menu.
- Search becomes full-width.
- Summary cards stack into one column.
- Address and hash values truncate in the middle with copy buttons.
- Transaction tables become stacked list rows.
- Tabs remain visible and tap-friendly.

Tablet/Desktop rules:

- Keep dense tables.
- Keep address/tx detail label-value tables two-column.
- Use sticky or persistent global search.

## Accessibility

- `/` focuses the global search input.
- All icon-only buttons need `aria-label` and tooltip text.
- Tables use semantic table markup on desktop.
- Mobile transaction cards preserve label/value semantics.
- Copy actions announce success with an accessible toast.
- Color is never the only indicator for transaction direction or status.
- All text must meet WCAG AA contrast.

## Performance

Targets:

- First contentful paint under 1.8s on a typical mobile connection.
- Address page API waterfall should be limited to summary, balances, and first transaction page.
- Token metadata should be cached and deduplicated.
- Avoid fetching optional portfolio sections until the Portfolio tab needs them.
- Use route-level code splitting for account dashboard/auth areas.

## Error States

Handle:

- Invalid search input.
- Address not found.
- Transaction hash not found.
- Upstream 401: show "Explorer API authentication is misconfigured" to admins/logs; generic failure to users.
- Upstream 429: "NomScan is receiving too many requests. Please retry shortly."
- Upstream 503/readiness failure: "Indexer is syncing or temporarily unavailable."
- Empty balances.
- Empty transaction history.
- Token metadata lookup failure.

## Security

- Never expose the nom-indexer-go JWT in browser code.
- Use strict CORS on NomScan API routes.
- Escape all chain data before rendering.
- Do not render decoded `data` or `input` as HTML.
- Add CSP headers.
- Rate-limit auth and search endpoints.
- Store user sessions as hashed tokens or signed/encrypted cookies.
- Log upstream errors without logging user session secrets.

## Analytics And Observability

Track privacy-safe events:

- Search submitted.
- Search type detected.
- Address page viewed.
- Transaction page viewed.
- Login success/failure.
- Save address.

Worker logs/metrics:

- Upstream status code.
- Upstream latency.
- Cache hit/miss for token metadata.
- Search not-found rate.
- 429/503 rates.

## Testing

Unit tests:

- Address/hash detection.
- Amount formatting with BigInt.
- Token decimal formatting.
- Direction badge logic.
- URL hash tab routing.

Integration tests:

- Worker proxy adds auth header.
- Worker maps upstream problem+json errors.
- Address summary endpoint aggregates account and balances.
- Transaction endpoint returns expected fields.

Browser tests:

- Home search address route.
- Home search hash route.
- Address page direct load to `#portfolios`.
- Address page direct load to `#transactions`.
- Transaction page load.
- Mobile 375px layout has no overlapping text.

Visual QA:

- Desktop 1440px.
- Tablet 768px.
- Mobile 375px.
- Light and dark themes.

## Acceptance Criteria

MVP is done when:

- A user can search a Zenon address from `/` and land on `/address/:address#portfolios`.
- A user can search an account-block hash from `/` and land on `/tx/:hash`.
- Address page has Portfolio and Transactions tabs matching the requested hash URLs.
- Address page shows balances, key account metrics, and paginated transactions.
- Transaction page shows a Blockscan-style details table for the account-block hash.
- All nom-indexer-go calls go through the Cloudflare Worker proxy.
- No nom-indexer-go JWT appears in the frontend bundle, network inspector, or page source.
- The app works at 375px width without broken layout.
- A user can log in, save an address, label it, and see it in their account watchlist.
- The app deploys to Cloudflare with SPA fallback and API routes working.

## Implementation Plan

### Phase 1: Foundation

- Scaffold React + TypeScript + Vite.
- Add Cloudflare Worker/static assets deployment.
- Add environment config and Worker proxy.
- Add global shell, theme tokens, and routing.
- Add nom-indexer-go API client types from OpenAPI or hand-written MVP types.

### Phase 2: Search And Public Pages

- Build home page and global search.
- Build address page shell.
- Build Portfolio tab.
- Build Transactions tab.
- Build transaction detail page.
- Add loading, empty, and error states.

### Phase 3: Login And User Features

- Add auth flow.
- Add D1 schema.
- Add account dashboard.
- Add saved addresses and private labels.
- Add watchlist affordances to address pages.

### Phase 4: Polish

- Responsive QA.
- Accessibility pass.
- Visual parity pass against Blockscan references.
- Zenon Tools theme tuning.
- Caching and performance tuning.
- Deploy preview and production Cloudflare setup.

## Open Questions

1. What production nom-indexer-go base URL should NomScan call?
2. Should NomScan support both `nomscan.com` and `www.nomscan.com`?
3. Which login method is preferred for MVP: email magic links, passkeys, or third-party OAuth?
4. Should NomScan include a light mode in MVP, or ship dark-only first to match `tools.zenon.info`?
5. Should transaction pages stitch paired send/receive account-blocks into one "complete transaction" view, or show the exact account-block first and paired block as a linked detail?
6. Is there an approved Zenon token price source for fiat portfolio values?
