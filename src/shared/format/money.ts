/**
 * Convert a raw integer-string chain amount + decimals to a plain JS Number,
 * for valuation/USD math only. Loses precision beyond ~15 significant digits
 * — fine for displayed USD values, never use for amount transport.
 */
export function rawToNumber(raw: string | null | undefined, decimals: number): number {
  if (!raw) return 0;
  const value = raw.startsWith("-") ? raw.slice(1) : raw;
  if (!/^\d+$/.test(value)) return 0;
  const padded = value.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, padded.length - decimals) || "0";
  const fracPart = decimals > 0 ? padded.slice(padded.length - decimals) : "";
  const n = Number(fracPart ? `${intPart}.${fracPart}` : intPart);
  return raw.startsWith("-") ? -n : n;
}

/** Format a USD value for display. Returns "$0.00" / "< $0.01" / "$1,234.56". */
export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0.00";
  if (Math.abs(value) < 0.01) return value < 0 ? "> -$0.01" : "< $0.01";
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}
