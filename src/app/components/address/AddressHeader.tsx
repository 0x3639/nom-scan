import { truncateMiddle } from "@shared/format/address";
import { CopyButton } from "../CopyButton";
import styles from "./AddressHeader.module.css";

interface Props {
  address: string;
}

export function AddressHeader({ address }: Props) {
  return (
    <header className={styles.wrap}>
      <div className={styles.top}>
        <h1 className={styles.label}>Address</h1>
      </div>
      <div className={styles.row}>
        <span className={`${styles.value} mono ${styles.full}`} title={address}>{address}</span>
        <span className={`${styles.value} mono ${styles.short}`} title={address}>
          {truncateMiddle(address, 10, 8)}
        </span>
        <CopyButton value={address} label="Copy address" />
      </div>
    </header>
  );
}
