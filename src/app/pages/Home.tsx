import { SearchInput } from "../components/SearchInput";
import styles from "./Home.module.css";

export function Home() {
  return (
    <section className={styles.wrap}>
      <h1 className={styles.title}>
        <span className={styles.titleMark}>PF</span>Scan
      </h1>
      <p className={styles.tagline}>Zenon Explorer · Portfolio · Transactions</p>
      <div className={styles.searchHolder}>
        <SearchInput autoFocus placeholder="Search by Address or Hash" />
      </div>
      <p className={styles.hint}>
        Press <kbd className={styles.kbd}>/</kbd> from anywhere to focus search.
      </p>
    </section>
  );
}
