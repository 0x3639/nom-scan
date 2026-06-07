import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./MomentumHeader.module.css";

interface Props {
  height: number;
  /** Chain tip; when known, disables "next" at the tip. Null = unknown (allow). */
  latest: number | null;
}

export function MomentumHeader({ height, latest }: Props) {
  const hasPrev = height > 1;
  const hasNext = latest == null ? true : height < latest;

  return (
    <header className={styles.wrap}>
      <h1 className={styles.title}>Momentum Details</h1>
      <nav className={styles.nav} aria-label="Momentum navigation">
        {hasPrev ? (
          <Link to={`/momentum/${height - 1}`} className={styles.arrow} aria-label="Previous momentum">
            <ChevronLeft size={16} />
          </Link>
        ) : (
          <span className={`${styles.arrow} ${styles.disabled}`} aria-disabled="true">
            <ChevronLeft size={16} />
          </span>
        )}
        <span className={`mono ${styles.height}`}>{height.toLocaleString()}</span>
        {hasNext ? (
          <Link to={`/momentum/${height + 1}`} className={styles.arrow} aria-label="Next momentum">
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span className={`${styles.arrow} ${styles.disabled}`} aria-disabled="true">
            <ChevronRight size={16} />
          </span>
        )}
      </nav>
    </header>
  );
}
