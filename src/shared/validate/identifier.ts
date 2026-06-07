export type QueryType = "address" | "hash" | "momentum" | "ambiguous" | "invalid";

// Zenon addresses are a fixed 40 chars: the `z1` prefix + a 38-char Bech32 body.
// Pin the body length exactly so wrong-length / over-length strings don't pass.
const ADDRESS_RE = /^z1[02-9ac-hj-np-z]{38}$/;
const HEX64_RE = /^[0-9a-fA-F]{64}$/;
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

/** Trims whitespace; does not change case (z1 addresses are case-sensitive Bech32). */
export function normalizeAddress(input: string): string {
  return input.trim();
}

export function isAddress(q: string): boolean {
  return ADDRESS_RE.test(normalizeAddress(q));
}

export function isHash(q: string): boolean {
  return HEX64_RE.test(normalizeHash(q));
}

export function isMomentumHeight(q: string): boolean {
  return MOMENTUM_RE.test(q.trim());
}

/** Trims to the canonical digit string. */
export function normalizeMomentum(input: string): string {
  return input.trim();
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
