import { Check, Copy } from "lucide-react";
import { useCopy } from "../hooks/useCopy";
import styles from "./CopyButton.module.css";

interface Props {
  value: string;
  label?: string;
  size?: number;
}

export function CopyButton({ value, label = "Copy", size = 14 }: Props) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      className={styles.btn}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied!" : label}
      onClick={() => void copy(value)}
    >
      {copied ? <Check size={size} aria-hidden /> : <Copy size={size} aria-hidden />}
      <span role="status" aria-live="polite" className="visually-hidden">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}
