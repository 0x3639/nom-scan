import styles from "./State.module.css";

interface Props {
  title?: string;
  message?: string;
}

export function EmptyState({ title = "Nothing to show", message }: Props) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {message ? <p className={styles.emptyMsg}>{message}</p> : null}
    </div>
  );
}
