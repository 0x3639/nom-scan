/**
 * Map a token symbol (case-insensitive) to the upstream price-feed key.
 * Used to value wrapped or aliased tokens — e.g. WBTC has no entry in the feed,
 * but its USD value tracks btc, so we look up the `btc` price for it.
 *
 * Keep this list short and conservative. Only add aliases where the price
 * relationship is effectively 1:1 and unambiguous.
 */
const ALIASES: Record<string, string> = {
  WBTC: "btc",
  WETH: "eth",
};

/**
 * Resolve a token's display symbol to the price-feed key. Returns the
 * lowercase key or null if no symbol was given.
 */
export function priceFeedKey(symbol: string | null | undefined): string | null {
  if (!symbol) return null;
  const upper = symbol.toUpperCase();
  return (ALIASES[upper] ?? upper).toLowerCase();
}
