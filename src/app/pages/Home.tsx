import { SearchInput } from "../components/SearchInput";
import styles from "./Home.module.css";

export function Home() {
  return (
    <section className={styles.wrap}>
      <h1 className={styles.title}>
        <span className={styles.titleMark}>NoM</span> Scan
      </h1>
      <p className={styles.tagline}>Zenon Explorer · Portfolio · Transactions</p>
      <div className={styles.searchHolder}>
        <SearchInput autoFocus enableShortcut placeholder="Search by Address, Hash or Momentum" />
      </div>
      <p className={styles.hint}>
        Press <kbd className={styles.kbd}>/</kbd> from anywhere to focus search.
      </p>
    </section>
  );
}
