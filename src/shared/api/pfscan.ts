/**
 * Public PFScan API contract — shared between Worker and React app.
 * The Worker produces these shapes; the React app consumes them.
 *
 * Amounts are always strings (BigInt-safe). Never coerce with Number().
 */

export type PFScanErrorCode =
  | "not_found"
  | "bad_request"
  | "upstream_auth"
  | "rate_limited"
  | "upstream_unavailable"
  | "upstream_error"
  | "internal";

export interface PFScanPagination {
  page: number;
  page_size: number;
  total?: number;
}

export interface PFScanError {
  code: PFScanErrorCode;
  message: string;
  status: number;
  retryAfter?: number;
}

export type PFScanResponse<T> =
  | { ok: true; data: T; pagination?: PFScanPagination }
  | { ok: false; error: PFScanError };

// ── Search ───────────────────────────────────────────────────────────────────
export type SearchKind = "address" | "tx" | "momentum" | "not_found";
export interface SearchResult {
  kind: SearchKind;
  target?: string;
}

// ── Prices ───────────────────────────────────────────────────────────────────
/**
 * USD prices keyed by lowercase symbol (e.g. "znn", "qsr", "btc", "eth").
 * Sourced from api.zenon.info/price via the Worker proxy.
 */
export type PriceMap = Record<string, number>;

// ── Token metadata ───────────────────────────────────────────────────────────
export interface TokenMeta {
  token_standard: string;
  name: string;
  symbol: string;
  decimals: number;
  total_supply?: string;
  max_supply?: string;
  owner?: string;
}

// ── Address summary ──────────────────────────────────────────────────────────
export interface AddressSummary {
  address: string;
  /** Account-blocks this address produced (sender side). */
  block_count?: number;
  /** Total account-blocks where this address appears (sender or paired recipient). */
  tx_count?: number;
  /** Unix-seconds timestamp of the earliest such block. */
  first_seen?: number | null;
  /** Unix-seconds timestamp of the most recent such block. */
  last_seen?: number | null;
  delegate?: string | null;
  // The Worker proxies the upstream account object directly; unknown fields are
  // preserved so the React layer can opportunistically render them.
  [key: string]: unknown;
}

// ── Balances ─────────────────────────────────────────────────────────────────
export interface BalanceEntry {
  token_standard: string;
  balance: string;
  /** Enriched by the Worker via the tokens cache. */
  token?: TokenMeta;
}

// ── Transactions ─────────────────────────────────────────────────────────────
export interface TxRow {
  hash: string;
  height?: number;
  block_type?: string | number;
  method?: string | null;
  address: string;
  to_address?: string | null;
  amount?: string | null;
  token_standard?: string | null;
  token?: TokenMeta;
  momentum_height?: number | null;
  momentum_hash?: string | null;
  /** Upstream uses momentum_timestamp; we also accept timestamp as a fallback. */
  momentum_timestamp?: number | null;
  timestamp?: number | null;
  paired_account_block?: string | null;
}

export interface TxDetail extends TxRow {
  momentum_height: number | null;
  momentum_hash: string | null;
  momentum_timestamp: number | null;
  data?: string | null;
  input?: unknown;
  decoded_input?: unknown;
  descendant_of?: string | null;
}

/** Pick the best available timestamp (seconds) for a tx-like object. */
export function txTimestamp(tx: { momentum_timestamp?: number | null; timestamp?: number | null }): number | null {
  return tx.momentum_timestamp ?? tx.timestamp ?? null;
}

// ── Momentum ─────────────────────────────────────────────────────────────────
export interface MomentumDetail {
  height: number;
  hash: string;
  /** Unix-seconds timestamp. */
  timestamp: number;
  /** Account-blocks contained in this momentum. */
  tx_count: number;
  producer: string;
  producer_owner?: string;
  producer_name?: string;
  /**
   * Derived by the Worker from the momentum at height-1. Absent at height 1 or
   * if the previous momentum couldn't be fetched. (The indexer's Momentum object
   * does not yet expose previousHash directly.)
   */
  previous_hash?: string;
  // The Worker proxies the upstream momentum object directly; unknown fields are
  // preserved so the Raw data view auto-upgrades when the indexer adds raw node
  // fields (publicKey, signature, changesHash, …).
  [key: string]: unknown;
}
