const UNITS: Array<[label: string, seconds: number]> = [
  ["y", 365 * 24 * 60 * 60],
  ["mo", 30 * 24 * 60 * 60],
  ["d", 24 * 60 * 60],
  ["h", 60 * 60],
  ["m", 60],
  ["s", 1],
];

/**
 * "3m ago", "2h ago", "just now". Accepts a unix timestamp in seconds.
 * 0 is treated as missing data, not the 1970 epoch — Go-style indexers emit 0
 * for unset int64 timestamps.
 */
export function formatAge(unixSeconds: number | null | undefined, now = Date.now()): string {
  if (unixSeconds == null || unixSeconds === 0) return "—";
  const diffSec = Math.max(0, Math.floor(now / 1000 - unixSeconds));
  if (diffSec < 5) return "just now";
  for (const [label, sec] of UNITS) {
    if (diffSec >= sec) {
      let n = Math.floor(diffSec / sec);
      // 30-day months and 365-day years overlap between day 360 and 365 —
      // cap at 11mo so the impossible "12mo ago" never renders.
      if (label === "mo") n = Math.min(n, 11);
      return `${n}${label} ago`;
    }
  }
  return "just now";
}

/** Absolute timestamp formatted locally (24h). Accepts unix seconds; 0 = missing. */
export function formatTimestamp(unixSeconds: number | null | undefined): string {
  if (unixSeconds == null || unixSeconds === 0) return "—";
  const d = new Date(unixSeconds * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Date only, no time. Accepts unix seconds; 0 = missing. Used in compact summary cards. */
export function formatDate(unixSeconds: number | null | undefined): string {
  if (unixSeconds == null || unixSeconds === 0) return "—";
  const d = new Date(unixSeconds * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
