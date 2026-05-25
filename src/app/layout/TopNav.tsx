import { Link, useLocation } from "react-router-dom";
import { SearchInput } from "../components/SearchInput";
import styles from "./TopNav.module.css";

export function TopNav() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <header className={styles.nav}>
      <div className={`${styles.inner} ${isHome ? styles.innerHome : ""}`}>
        <Link to="/" className={styles.brand} aria-label="NoM Scan home">
          <span className={styles.brandMark}>NoM</span>
          <span className={styles.brandWord}>Scan</span>
        </Link>

        {/* On the home page the hero search owns the search affordance, so we
            hide the compact nav search to match the Blockscan home layout. */}
        {isHome ? null : (
          <div className={styles.search}>
            <SearchInput
              compact
              enableShortcut
              placeholder="Search by Address or Hash"
            />
          </div>
        )}

        <div className={styles.right}>
          <Link to="/login" className={styles.account}>Sign in</Link>
        </div>
      </div>
    </header>
  );
}
