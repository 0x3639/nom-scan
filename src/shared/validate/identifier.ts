export type QueryType = "address" | "hash" | "momentum" | "ambiguous" | "invalid";

// Zenon addresses are a fixed 40 chars: the `z1` prefix + a 38-char Bech32 body.
// Pin the body length exactly so wrong-length / over-length strings don't pass.
const ADDRESS_RE = /^z1[02-9ac-hj-np-z]{38}$/;
// BIP-173 also defines the all-uppercase encoding (QR alphanumeric mode) as valid.
const UPPER_ADDRESS_RE = /^Z1[02-9AC-HJ-NP-Z]{38}$/;
const HEX64_RE = /^[0-9a-fA-F]{64}$/;
// A ZTS token standard is `zts1` + a 22-char Bech32 body (e.g. the ZNN standard
// zts1znnxxxxxxxxxxxxx9z4ulx).
const TOKEN_STANDARD_RE = /^zts1[02-9ac-hj-np-z]{22}$/;
// A momentum height is a positive integer with no leading zero. Cap at 15 digits
// so the value always stays within Number.MAX_SAFE_INTEGER (~9.007e15): the Worker
// and UI convert heights to Number for path building / nav math, so a larger value
// would round and look up the wrong momentum. 15 digits is astronomically beyond
// any real chain height.
const MOMENTUM_RE = /^[1-9]\d{0,14}$/;

/** Strips an optional 0x prefix and lowercases for hash lookup. */
export function normalizeHash(input: string): string {
  const trimmed = input.trim();
  return (trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed.slice(2) : trimmed).toLowerCase();
}

/**
 * Trims whitespace. Bech32 is canonically lowercase, but BIP-173 treats the
 * all-uppercase form as the same address (QR codes emit it), so that one case
 * is folded down. Mixed case stays untouched — it's invalid in Bech32.
 */
export function normalizeAddress(input: string): string {
  const trimmed = input.trim();
  return UPPER_ADDRESS_RE.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}

export function isAddress(q: string): boolean {
  return ADDRESS_RE.test(normalizeAddress(q));
}

export function isHash(q: string): boolean {
  return HEX64_RE.test(normalizeHash(q));
}

export function isMomentumHeight(q: string): boolean {
  return MOMENTUM_RE.test(normalizeMomentum(q));
}

/**
 * Trims and strips thousands-separator commas to the canonical digit string,
 * so a height pasted back in display form ("12,708,298") parses as 12708298.
 * Commas are only stripped when they sit at correct 3-digit group positions —
 * "1,2" must stay invalid rather than silently becoming height 12.
 */
export function normalizeMomentum(input: string): string {
  const trimmed = input.trim();
  return /^\d{1,3}(,\d{3})+$/.test(trimmed) ? trimmed.replace(/,/g, "") : trimmed;
}

export function isTokenStandard(q: string): boolean {
  return TOKEN_STANDARD_RE.test(q.trim());
}

export function detectQueryType(q: string): QueryType {
  const t = q.trim();
  if (!t) return "invalid";
  const addr = isAddress(t);
  const hash = isHash(t);
  if (addr && hash) return "ambiguous";
  if (addr) return "address";
  if (hash) return "hash";
  if (isMomentumHeight(t)) return "momentum";
  return "invalid";
}
