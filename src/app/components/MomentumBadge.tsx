import { useStatus } from "../api/queries";
import styles from "./MomentumBadge.module.css";

/**
 * Compact "Momentum N" badge sourced from the indexer status endpoint.
 * Renders nothing if the height isn't available yet — never shows a skeleton.
 */
export function MomentumBadge() {
  const status = useStatus();
  const height =
    status.data && typeof status.data === "object" && status.data !== null
      ? (status.data as Record<string, unknown>)["latest_height"] ??
        (status.data as Record<string, unknown>)["momentum_height"] ??
        (status.data as Record<string, unknown>)["height"] ??
        null
      : null;

  if (typeof height !== "number" && typeof height !== "string") return null;

  return (
    <span className={styles.badge} title="Latest momentum height">
      <span className={styles.label}>Momentum</span>
      <span className={`${styles.value} mono`}>{String(height)}</span>
    </span>
  );
}
