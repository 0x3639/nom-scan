import { useLatestMomentumHeight } from "../api/queries";
import styles from "./MomentumBadge.module.css";

/**
 * Compact "Momentum N" badge sourced from the indexer status endpoint.
 * Renders nothing if the height isn't available yet — never shows a skeleton.
 */
export function MomentumBadge() {
  const height = useLatestMomentumHeight();
  if (height == null) return null;

  return (
    <span className={styles.badge} title="Latest momentum height">
      <span className={styles.label}>Momentum</span>
      <span className={`${styles.value} mono`}>{height.toLocaleString()}</span>
    </span>
  );
}
