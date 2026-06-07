# Design: Search by Momentum Number → Momentum Detail page

Date: 2026-06-07
Status: Approved (brainstorming complete; ready for implementation plan)
Branch: `momentum-search`

## Summary

Add momentum search to NoM Scan. A user can type a momentum **height/number**
into the existing search box and land on a new **Momentum Detail** page at
`/momentum/:height`. Momentum **hash** search is deferred (the indexer has no
by-hash endpoint yet — see Indexer Requests).

## Decisions (from brainstorming)

1. **Hash lookup:** number-only now; request a momentum-by-hash endpoint from the
   indexer team and wire hash search once it lands.
2. **Search UX:** auto-detect — a plain integer in the single smart search box is
   treated as a momentum height. No "Search by" selector/dropdown.
3. **Landing page:** dedicated `/momentum/:height` detail page with prev/next
   height navigation, modeled on the existing transaction page.
4. **Raw data:** ship with the fields the indexer exposes today; request the
   indexer add the full raw node fields. The Raw data view auto-upgrades when
   they land.

## Indexer contract (verified against OpenAPI)

`GET /api/v1/momentums/{height}` → returns the `Momentum` object directly:

| Field | Type | Notes |
|-------|------|-------|
| `height` | int64 | momentum height/number |
| `hash` | string | momentum hash |
| `timestamp` | int64 | unix seconds |
| `tx_count` | integer | account blocks in the momentum |
| `producer` | string | `z1…` address |
| `producer_owner` | string | optional |
| `producer_name` | string | optional |

Supporting endpoints: `GET /api/v1/momentums/latest` (single `Momentum`, used to
bound "next"), `GET /api/v1/momentums` (paginated list — not needed here).

**Not currently exposed** (present in the design mockup's raw block, but absent
from the `Momentum` schema): `previousHash`, `version`, `chainIdentifier`,
`changesHash`, `publicKey`, `signature`, `content`, `data`. There is also **no**
momentum-by-hash endpoint and **no** endpoint to list the account blocks within a
momentum.

## Architecture

Two-tier model unchanged (non-negotiable): React app → NoM Scan Worker API →
nom-indexer-go with a minted JWT. The frontend never calls the indexer directly.

### 1. Identifier detection — `src/shared/validate/identifier.ts`

- Add `"momentum"` to `QueryType`.
- Add `isMomentumHeight(q)`: matches `^\d+$` after trim, rejects leading-zero
  noise beyond a single `0`, and guards an upper length (≤ 18 digits) so absurd
  inputs don't pass. Value `0` is treated as invalid (momentum heights start at 1).
- `detectQueryType` precedence: address → hash → **momentum** → invalid.
  (No collision: addresses are `z1…`, hashes are 64 hex; a bare integer is none
  of those.)
- Add `normalizeMomentum(q)`: trims and returns the canonical digit string.

### 2. Worker API

- New route `GET /api/momentum/:height` (`src/worker/routes/momentum.ts`,
  registered in `src/worker/index.ts`).
  - Validate `:height` is a positive integer; else `bad_request` 400.
  - Fetch `/api/v1/momentums/{height}` and, in parallel,
    `/api/v1/momentums/{height-1}` to derive **Previous Hash** (its `.hash`).
    For `height === 1` there is no previous; `previousHash` is omitted.
  - The previous-momentum fetch is best-effort: a 404/empty there does not fail
    the request — it just omits `previousHash`.
  - Return a `MomentumDetail` envelope (`{ ok: true, data }`); 404 passthrough
    when the requested height doesn't exist.
- `/api/search` (`src/worker/routes/search.ts`): when `detectQueryType` is
  `momentum`, check `/api/v1/momentums/{height}` existence and return
  `{ kind: "momentum", target: height }` or `{ kind: "not_found" }`.
- Types (`src/shared/api/pfscan.ts`):
  - Extend `SearchKind` with `"momentum"`.
  - Add `MomentumDetail` = the `Momentum` fields above + optional
    `previous_hash: string`. Amounts/large ints follow existing string/BigInt
    conventions where relevant (heights fit in JS number range for display but we
    keep `hash`/strings as-is).

### 3. Frontend

- **Router** (`src/app/router.tsx`): add lazy route
  `{ path: "/momentum/:height", element: <MomentumPage /> }`.
- **Query hook** (`src/app/api/queries.ts`): `useMomentum(height)` →
  `pfscanFetch<MomentumDetail>("/api/momentum/:height")` with a stable
  `queryKey` and sensible `staleTime` (momentums are immutable once produced, so
  a long staleTime is fine).
- **`SearchInput`** (`src/app/components/SearchInput.tsx`): route `momentum`
  queries to `/momentum/${normalizeMomentum(q)}`. Update placeholder to
  "Search by Address, Hash, or Momentum #".
- **`MomentumPage`** (`src/app/pages/MomentumPage.tsx`) + components, modeled on
  `TxPage`:
  - Breadcrumb: Home / Momentum / `#<height>`.
  - Header "Momentum Details" with prev/next: `<` → `/momentum/(height-1)`
    (disabled at height 1), `>` → `/momentum/(height+1)` (disabled when
    `height >= latest`; latest obtained via a lightweight `useLatestMomentum`
    hook hitting a Worker passthrough, or by disabling only when the next fetch
    404s — see Open Items).
  - Detail card rows: Momentum Hash (mono), Momentum Height (formatted with
    thousands separators), Timestamp (local-tz via existing formatter), Producer
    (linked to `/address/:producer`, show `producer_name`/owner when present),
    Previous Hash (mono, linked to its momentum page when derivable), Tx Count.
  - Raw data: `<pre>` JSON of the proxied `MomentumDetail`, same styling as the
    tx page's raw block.
  - Loading (skeleton), error (`ErrorState`), and not-found (`NotFoundState`)
    states mirror `TxPage`.
- **Bonus (optional, low cost):** make the existing `MomentumBadge`/momentum
  height on the tx page link to `/momentum/:height`.

## Error / edge handling

- Non-numeric or `0` height → client shows `NotFoundState` ("Invalid momentum
  height"); Worker returns `bad_request` for malformed input.
- Height above chain tip → indexer 404 → `NotFoundState` ("Momentum not found").
- Previous-hash derivation failure is silent (field omitted), never fails the page.
- Prev arrow disabled at height 1; next arrow disabled at chain tip.

## Testing

- `identifier.test.ts`: integer → `momentum`; `0`, negatives, overly long,
  `z1…`, and 64-hex inputs are NOT momentum; precedence holds.
- Worker `momentum.routes.test.ts`: happy path; previous-hash derivation present
  and omitted (height 1 / previous 404); requested-height 404 passthrough;
  malformed height 400.
- `search` route test: integer query → `{ kind: "momentum" }` and `not_found`.
- Keep within existing Vitest patterns; no new test infra.

## Open items (resolve during implementation)

- **"Next" disabling at the tip:** prefer a small `useLatestMomentum` hook
  (Worker passthrough to `/api/v1/momentums/latest`) to know the tip; fallback is
  to allow clicking next and show NotFound past the tip. Pick the hook approach
  if cheap; otherwise fallback.

## Indexer Requests (to send the indexer team)

1. **Momentum by hash:** `GET /api/v1/momentums/hash/{hash}` (or a `?hash=`
   filter) returning the same `Momentum` object. Unblocks momentum-hash search.
2. **Full raw momentum fields:** add `previous_hash`, `version`,
   `chain_identifier`, `changes_hash`, `public_key`, `signature`, and
   `data`/`content` to the `Momentum` schema (or a `MomentumDetail` variant on
   `/momentums/{height}`). Unblocks the complete Raw data view and lets us drop
   the derived-previous-hash workaround.

## Out of scope

- Momentum hash search (until request #1 lands).
- Listing the account blocks contained in a momentum (no upstream endpoint).
- "Search by" selector UI, multi-chain, analytics.
