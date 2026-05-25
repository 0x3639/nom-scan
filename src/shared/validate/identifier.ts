export type QueryType = "address" | "hash" | "ambiguous" | "invalid";

const ADDRESS_RE = /^z1[02-9ac-hj-np-z]{37,}$/;
const HEX64_RE = /^[0-9a-fA-F]{64}$/;

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

export function detectQueryType(q: string): QueryType {
  const t = q.trim();
  if (!t) return "invalid";
  const addr = isAddress(t);
  const hash = isHash(t);
  if (addr && hash) return "ambiguous";
  if (addr) return "address";
  if (hash) return "hash";
  return "invalid";
}
