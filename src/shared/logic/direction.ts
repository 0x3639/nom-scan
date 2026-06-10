import type { TxRow } from "@shared/api/nomscan";

export type DirectionBadge = "IN" | "OUT" | "SELF" | "PAIR";

/**
 * Direction of a transaction row relative to the viewed address.
 *  - OUT  : viewed address is the sender (`address`), recipient differs
 *  - IN   : viewed address is the recipient (`to_address`), sender differs
 *  - SELF : both sides are the viewed address
 *  - PAIR : the row is a receive account-block paired to a send (no to_address match)
 */
/** NoM's burn/zero address — receive blocks carry it as a placeholder to_address. */
export const ZERO_ADDRESS = "z1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsggv2f";

// go-zenon block types: 1 genesis-receive, 2 user-send, 3 user-receive,
// 4 contract-send, 5 contract-receive.
const RECEIVE_BLOCK_TYPES = new Set([1, 3, 5]);

/**
 * True when the row is a receive account-block. `block_type` is the primary
 * signal (live indexer data emits it numerically); the to_address heuristic
 * covers rows where it's absent — receives have no real recipient of their
 * own (empty or the zero-address placeholder) plus a paired send reference.
 */
function isReceiveRow(row: TxRow): boolean {
  const bt = row.block_type;
  if (typeof bt === "number") return RECEIVE_BLOCK_TYPES.has(bt);
  if (typeof bt === "string") {
    if (/receive/i.test(bt)) return true;
    if (/send/i.test(bt)) return false;
    if (/^\d+$/.test(bt)) return RECEIVE_BLOCK_TYPES.has(Number(bt));
  }
  const recipient = (row.to_address ?? "").trim();
  return Boolean(row.paired_account_block) && (!recipient || recipient === ZERO_ADDRESS);
}

export function getDirection(row: TxRow, viewedAddress: string): DirectionBadge {
  const sender = (row.address ?? "").trim();
  const recipient = (row.to_address ?? "").trim();
  const me = viewedAddress.trim();

  // On a receive account-block, `address` is the block OWNER (the receiver),
  // not the sender — the funds arrived via the paired send block. This must be
  // classified before the sender===me branch, or every receive block in the
  // owner's own list would mislabel as OUT.
  if (isReceiveRow(row)) return "PAIR";

  if (sender === me && recipient === me) return "SELF";
  if (sender === me) return "OUT";
  if (recipient === me) return "IN";
  return "PAIR";
}
