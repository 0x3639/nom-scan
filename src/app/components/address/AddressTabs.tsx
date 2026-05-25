import styles from "./AddressTabs.module.css";

export type AddressTab = "portfolios" | "transactions";

interface Props {
  active: AddressTab;
  onChange: (tab: AddressTab) => void;
}

const TABS: Array<{ id: AddressTab; label: string }> = [
  { id: "portfolios", label: "Portfolio" },
  { id: "transactions", label: "Transactions" },
];

export function AddressTabs({ active, onChange }: Props) {
  return (
    <div className={styles.bar} role="tablist" aria-label="Address sections">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          tabIndex={active === t.id ? 0 : -1}
          className={`${styles.tab} ${active === t.id ? styles.active : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
