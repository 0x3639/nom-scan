import styles from "./PageSizeSelect.module.css";

const OPTIONS = [10, 25, 50, 100];

interface Props {
  value: number;
  onChange: (next: number) => void;
}

export function PageSizeSelect({ value, onChange }: Props) {
  return (
    <label className={styles.wrap}>
      <span className={styles.label}>Show</span>
      <select
        className={`${styles.select} mono`}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Transactions per page"
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <span className={styles.label}>per page</span>
    </label>
  );
}
