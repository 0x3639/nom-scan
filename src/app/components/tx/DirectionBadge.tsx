import type { DirectionBadge as DirectionType } from "@shared/logic/direction";
import styles from "./DirectionBadge.module.css";

interface Props {
  direction: DirectionType;
}

const LABELS: Record<DirectionType, string> = {
  IN: "IN",
  OUT: "OUT",
  SELF: "SELF",
  PAIR: "PAIR",
};

export function DirectionBadge({ direction }: Props) {
  return (
    <span className={`${styles.badge} ${styles[direction.toLowerCase() as Lowercase<DirectionType>]}`}>
      {LABELS[direction]}
    </span>
  );
}
