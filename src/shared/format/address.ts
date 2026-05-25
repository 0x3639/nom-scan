/**
 * Truncate a long identifier with an ellipsis in the middle.
 * `z1qzfag... abc123` style. Returns the original string if it's short enough.
 */
export function truncateMiddle(value: string, head = 8, tail = 6): string {
  if (!value) return "";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
