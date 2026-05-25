import styles from "./State.module.css";

interface Props {
  title?: string;
  message?: string;
  query?: string;
}

export function NotFoundState({ title = "Not found", message, query }: Props) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {query ? (
        <p className={styles.emptyMsg}>
          Nothing matches <span className="mono" style={{ color: "var(--color-text)" }}>{query}</span>.
        </p>
      ) : null}
      {message ? <p className={styles.emptyMsg}>{message}</p> : null}
    </div>
  );
}
