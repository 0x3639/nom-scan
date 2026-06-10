import type { TxRow } from "@shared/api/nomscan";

export type DirectionBadge = "IN" | "OUT" | "SELF" | "PAIR";

/**
 * Direction of a transaction row relative to the viewed address.
 *  - OUT  : viewed address is the sender (`address`), recipient differs
 *  - IN   : viewed address is the recipient (`to_address`), sender differs
 *  - SELF : both sides are the viewed address
 *  - PAIR : the row is a receive account-block paired to a send (no to_address match)
 */
export function getDirection(row: TxRow, viewedAddress: string): DirectionBadge {
  const sender = (row.address ?? "").trim();
  const recipient = (row.to_address ?? "").trim();
  const me = viewedAddress.trim();

  // A receive account-block carries no to_address of its own — the funds arrived
  // via the paired send block, and `address` is the block OWNER (the receiver),
  // not the sender. This must be classified before the sender===me branch, or
  // every receive block in the owner's own list would mislabel as OUT.
  if (!recipient && row.paired_account_block) return "PAIR";

  if (sender === me && recipient === me) return "SELF";
  if (sender === me) return "OUT";
  if (recipient === me) return "IN";
  return "PAIR";
}
