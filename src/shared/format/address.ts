/**
 * Truncate a long identifier with an ellipsis in the middle.
 * `z1qzfag... abc123` style. Returns the original string if it's short enough.
 */
export function truncateMiddle(value: string, head = 8, tail = 6): string {
  if (!value) return "";
  // slice(-0) is slice(0) — the whole string — so a zero tail must be special-cased.
  const h = Math.max(0, head);
  const t = Math.max(0, tail);
  if (value.length <= h + t + 1) return value;
  return `${value.slice(0, h)}…${t > 0 ? value.slice(-t) : ""}`;
}
