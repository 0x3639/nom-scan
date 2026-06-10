export interface FormatAmountOptions {
  maxFractionDigits?: number;
  trimZeros?: boolean;
  group?: boolean;
}

const DEFAULT_OPTS: Required<FormatAmountOptions> = {
  maxFractionDigits: 8,
  trimZeros: true,
  group: true,
};

function groupThousands(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format a JSON-string chain amount with the token's decimal precision.
 * Never coerces to Number — uses BigInt + string arithmetic.
 */
export function formatAmount(
  raw: string | null | undefined,
  decimals: number,
  opts: FormatAmountOptions = {},
): string {
  const { maxFractionDigits, trimZeros, group } = { ...DEFAULT_OPTS, ...opts };
  if (raw == null || raw === "") return "0";

  let negative = false;
  let value = raw.trim();
  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  }
  if (!/^\d+$/.test(value)) return raw;
  // Canonicalize zero-padded raw values ("0123" with 2 decimals is 1.23, not 01.23).
  value = value.replace(/^0+(?=\d)/, "");

  if (decimals <= 0) {
    const intPart = group ? groupThousands(value) : value;
    return negative ? `-${intPart}` : intPart;
  }

  const padded = value.padStart(decimals + 1, "0");
  const intDigits = padded.slice(0, padded.length - decimals);
  let fracDigits = padded.slice(padded.length - decimals);

  let truncatedNonzero = false;
  if (fracDigits.length > maxFractionDigits) {
    truncatedNonzero = /[1-9]/.test(fracDigits.slice(maxFractionDigits));
    fracDigits = fracDigits.slice(0, maxFractionDigits);
  }
  if (trimZeros) {
    fracDigits = fracDigits.replace(/0+$/, "");
  }
  const intOut = group ? groupThousands(intDigits) : intDigits;
  const result = fracDigits ? `${intOut}.${fracDigits}` : intOut;
  // A nonzero balance must never display as plain "0" — when every significant
  // digit sits below maxFractionDigits (e.g. an 18-decimal token's dust with the
  // default 8 display digits), show a below-precision indicator instead.
  // Mirrors the "< $0.01" / "> -$0.01" convention in money.ts.
  if (truncatedNonzero && /^0*$/.test(intDigits) && !fracDigits) {
    const smallest = maxFractionDigits > 0 ? `0.${"0".repeat(maxFractionDigits - 1)}1` : "1";
    return negative ? `> -${smallest}` : `< ${smallest}`;
  }
  return negative && result !== "0" ? `-${result}` : result;
}

/**
 * Inverse of formatAmount: parse a user-entered decimal string into a raw
 * integer string honoring the token's decimals.
 *
 * NOTE: currently unused by the app — NoM Scan is a read-only explorer with no
 * write paths. Kept (and unit-tested) for a future amount-entry surface; remove
 * if that never materializes.
 */
export function parseAmount(input: string, decimals: number): string {
  const trimmed = input.trim();
  if (!trimmed) return "0";
  const [intPart = "0", fracPart = ""] = trimmed.split(".");
  const safeInt = intPart.replace(/[^\d-]/g, "") || "0";
  const safeFrac = fracPart.replace(/\D/g, "").padEnd(decimals, "0").slice(0, decimals);
  const joined = `${safeInt}${safeFrac}`.replace(/^(-?)0+(\d)/, "$1$2");
  return joined === "" ? "0" : joined;
}
