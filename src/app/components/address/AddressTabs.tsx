import { useRef, type KeyboardEvent } from "react";
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
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectAt(index: number) {
    const next = TABS[index];
    if (!next) return;
    onChange(next.id);
    tabRefs.current[index]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((t) => t.id === active);
    if (current < 0) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      selectAt((current - 1 + TABS.length) % TABS.length);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      selectAt((current + 1) % TABS.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectAt(0);
    } else if (e.key === "End") {
      e.preventDefault();
      selectAt(TABS.length - 1);
    }
  }

  return (
    <div className={styles.bar} role="tablist" aria-label="Address sections" onKeyDown={onKeyDown}>
      {TABS.map((t, index) => (
        <button
          key={t.id}
          ref={(node) => {
            tabRefs.current[index] = node;
          }}
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
