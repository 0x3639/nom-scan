import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.brand}>NoM Scan</span>
        <span className={styles.dot}>·</span>
        <a href="https://zenon.network" rel="noreferrer noopener" target="_blank">Zenon Network</a>
        <span className={styles.dot}>·</span>
        <a href="https://tools.zenon.info" rel="noreferrer noopener" target="_blank">Zenon Tools</a>
        <span className={styles.dot}>·</span>
        <a href="https://zenonhub.io" rel="noreferrer noopener" target="_blank">Zenon Hub</a>
      </div>
    </footer>
  );
}
