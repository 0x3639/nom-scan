import { Link } from "react-router-dom";
import type { MomentumDetail } from "@shared/api/pfscan";
import { formatTimestamp } from "@shared/format/time";
import styles from "../tx/TxDetailsTable.module.css";

interface Props {
  momentum: MomentumDetail;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className={styles.row}>
      <th scope="row" className={styles.label}>{label}</th>
      <td className={styles.value}>{children}</td>
    </tr>
  );
}

function Mono({ value }: { value: string }) {
  return <span className={`mono ${styles.mono}`}>{value}</span>;
}

export function MomentumDetailsTable({ momentum }: Props) {
  const producerLabel = momentum.producer_name || momentum.producer_owner || null;

  return (
    <table className={styles.table}>
      <tbody>
        <Row label="Momentum Hash"><Mono value={momentum.hash} /></Row>
        <Row label="Momentum Height"><Mono value={momentum.height.toLocaleString()} /></Row>
        <Row label="Timestamp">
          {momentum.timestamp != null ? formatTimestamp(momentum.timestamp) : <span className={styles.muted}>—</span>}
        </Row>
        <Row label="Producer">
          {momentum.producer ? (
            <Link to={`/address/${momentum.producer}#portfolios`} className={`mono ${styles.link}`}>
              {momentum.producer}
            </Link>
          ) : <span className={styles.muted}>—</span>}
          {producerLabel ? <span className={styles.muted}> ({producerLabel})</span> : null}
        </Row>
        <Row label="Previous Hash">
          {momentum.previous_hash && momentum.height > 1 ? (
            <Link to={`/momentum/${momentum.height - 1}`} className={`mono ${styles.link}`}>
              {momentum.previous_hash}
            </Link>
          ) : <span className={styles.muted}>—</span>}
        </Row>
        <Row label="Tx Count">
          {momentum.tx_count != null ? momentum.tx_count.toLocaleString() : <span className={styles.muted}>—</span>}
        </Row>
      </tbody>
    </table>
  );
}
