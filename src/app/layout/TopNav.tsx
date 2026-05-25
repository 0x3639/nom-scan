import { Link, useLocation } from "react-router-dom";
import { SearchInput } from "../components/SearchInput";
import { useStatus } from "../api/queries";
import styles from "./TopNav.module.css";

export function TopNav() {
  const location = useLocation();
  const status = useStatus();
  const momentumHeight =
    status.data && typeof status.data === "object" && status.data !== null
      ? (status.data as Record<string, unknown>)["latest_height"] ??
        (status.data as Record<string, unknown>)["momentum_height"] ??
        (status.data as Record<string, unknown>)["height"] ??
        null
      : null;

  return (
    <header className={styles.nav}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand} aria-label="PFScan home">
          <span className={styles.brandMark}>PF</span>
          <span className={styles.brandWord}>Scan</span>
        </Link>

        <div className={styles.search}>
          <SearchInput
            compact
            enableShortcut={location.pathname !== "/"}
            placeholder="Search by Address or Hash"
          />
        </div>

        <div className={styles.right}>
          {typeof momentumHeight === "number" || typeof momentumHeight === "string" ? (
            <span className={styles.momentum} title="Latest momentum height">
              <span className={styles.momentumLabel}>Momentum</span>
              <span className={`${styles.momentumValue} mono`}>{String(momentumHeight)}</span>
            </span>
          ) : null}
          <Link to="/login" className={styles.account}>Sign in</Link>
        </div>
      </div>
    </header>
  );
}
