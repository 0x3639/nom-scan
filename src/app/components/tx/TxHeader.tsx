import { truncateMiddle } from "@shared/format/address";
import { CopyButton } from "../CopyButton";
import styles from "./TxHeader.module.css";

interface Props {
  hash: string;
  status: "confirmed" | "unknown";
}

export function TxHeader({ hash, status }: Props) {
  return (
    <header className={styles.wrap}>
      <div className={styles.top}>
        <h1 className={styles.title}>Transaction Details</h1>
        <span
          className={`${styles.statusBadge} ${
            status === "confirmed" ? styles.confirmed : styles.unknown
          }`}
          aria-label={status === "confirmed" ? "Status: confirmed" : "Status: unknown"}
        >
          {status === "confirmed" ? "● Confirmed" : "○ Unknown"}
        </span>
      </div>
      <div className={styles.row}>
        <span className={`mono ${styles.full}`} title={hash}>{hash}</span>
        <span className={`mono ${styles.short}`} title={hash}>{truncateMiddle(hash, 14, 10)}</span>
        <CopyButton value={hash} label="Copy hash" />
      </div>
    </header>
  );
}
