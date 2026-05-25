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

  if (decimals <= 0) {
    const intPart = group ? groupThousands(value) : value;
    return negative ? `-${intPart}` : intPart;
  }

  const padded = value.padStart(decimals + 1, "0");
  const intDigits = padded.slice(0, padded.length - decimals);
  let fracDigits = padded.slice(padded.length - decimals);

  if (fracDigits.length > maxFractionDigits) {
    fracDigits = fracDigits.slice(0, maxFractionDigits);
  }
  if (trimZeros) {
    fracDigits = fracDigits.replace(/0+$/, "");
  }
  const intOut = group ? groupThousands(intDigits) : intDigits;
  const result = fracDigits ? `${intOut}.${fracDigits}` : intOut;
  return negative && result !== "0" ? `-${result}` : result;
}

/**
 * Inverse of formatAmount: parse a user-entered decimal string into a raw
 * integer string honoring the token's decimals. For future write paths.
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
