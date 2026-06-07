import { Link } from "react-router-dom";
import type { TxDetail } from "@shared/api/nomscan";
import { txTimestamp } from "@shared/api/nomscan";
import { formatAmount } from "@shared/format/amount";
import { formatTimestamp } from "@shared/format/time";
import styles from "./TxDetailsTable.module.css";

interface Props {
  tx: TxDetail;
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

function describeBlockType(value: unknown): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function decodedInputText(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

export function TxDetailsTable({ tx }: Props) {
  const decimals = tx.token?.decimals ?? 8;
  const amount = tx.amount ? formatAmount(tx.amount, decimals) : "—";
  const symbol = tx.token?.symbol ?? "";
  const decoded = decodedInputText(tx.decoded_input ?? tx.input);

  return (
    <table className={styles.table}>
      <tbody>
        <Row label="Transaction Hash"><Mono value={tx.hash} /></Row>
        <Row label="Status"><span className={styles.statusOk}>Confirmed</span></Row>
        <Row label="Block Type">{describeBlockType(tx.block_type)}</Row>
        <Row label="Method">
          {tx.method ? <span className={styles.method}>{tx.method}</span> : <span className={styles.muted}>—</span>}
        </Row>
        <Row label="Momentum Height">
          {tx.momentum_height != null ? (
            <Link to={`/momentum/${tx.momentum_height}`} className={`mono ${styles.link}`}>
              {tx.momentum_height.toLocaleString()}
            </Link>
          ) : <span className={styles.muted}>—</span>}
        </Row>
        <Row label="Momentum Hash">
          {tx.momentum_hash ? <Mono value={tx.momentum_hash} /> : <span className={styles.muted}>—</span>}
        </Row>
        <Row label="Timestamp">
          {(() => {
            const t = txTimestamp(tx);
            return t != null ? formatTimestamp(t) : <span className={styles.muted}>—</span>;
          })()}
        </Row>
        <Row label="From">
          {tx.address ? (
            <Link to={`/address/${tx.address}#portfolios`} className={`mono ${styles.link}`}>{tx.address}</Link>
          ) : <span className={styles.muted}>—</span>}
        </Row>
        <Row label="To">
          {tx.to_address ? (
            <Link to={`/address/${tx.to_address}#portfolios`} className={`mono ${styles.link}`}>{tx.to_address}</Link>
          ) : <span className={styles.muted}>—</span>}
        </Row>
        <Row label="Amount">
          <span className={`mono ${styles.amount}`}>{amount}</span>
          {symbol ? <span className={styles.symbol}> {symbol}</span> : null}
        </Row>
        <Row label="Token">
          {tx.token ? (
            <span className="mono" title={tx.token.token_standard}>{tx.token.name} ({tx.token.symbol})</span>
          ) : tx.token_standard ? (
            <Mono value={tx.token_standard} />
          ) : <span className={styles.muted}>—</span>}
        </Row>
        <Row label="Paired Account Block">
          {tx.paired_account_block ? (
            <Link to={`/tx/${tx.paired_account_block}`} className={`mono ${styles.link}`}>
              {tx.paired_account_block}
            </Link>
          ) : <span className={styles.muted}>—</span>}
        </Row>
        {tx.descendant_of ? (
          <Row label="Descendant Of"><Mono value={tx.descendant_of} /></Row>
        ) : null}
        {tx.data ? (
          <Row label="Data">
            <pre className={styles.pre}>{tx.data}</pre>
          </Row>
        ) : null}
        {decoded ? (
          <Row label="Decoded Input">
            <pre className={styles.pre}>{decoded}</pre>
          </Row>
        ) : null}
      </tbody>
    </table>
  );
}
