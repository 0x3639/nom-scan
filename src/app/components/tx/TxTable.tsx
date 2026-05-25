import { Link } from "react-router-dom";
import type { TxRow } from "@shared/api/pfscan";
import { txTimestamp } from "@shared/api/pfscan";
import { getDirection } from "@shared/logic/direction";
import { formatAmount } from "@shared/format/amount";
import { truncateMiddle } from "@shared/format/address";
import { formatAge } from "@shared/format/time";
import { useTokens } from "../../api/queries";
import { DirectionBadge } from "./DirectionBadge";
import styles from "./TxTable.module.css";

interface Props {
  rows: TxRow[];
  viewedAddress?: string;
}

function safeMomentum(value: number | null | undefined): string {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

export function TxTable({ rows, viewedAddress }: Props) {
  const tokens = useTokens(rows.map((r) => r.token_standard));
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Hash</th>
          <th>Type / Method</th>
          <th>Age</th>
          <th>From</th>
          <th>To</th>
          <th>Dir</th>
          <th className={styles.numeric}>Amount</th>
          <th>Token</th>
          <th className={styles.numeric}>Momentum</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const direction = viewedAddress ? getDirection(row, viewedAddress) : "PAIR";
          const token = row.token ?? (row.token_standard ? tokens.get(row.token_standard) : undefined);
          const decimals = token?.decimals ?? 8;
          const symbol = token?.symbol ?? "—";
          return (
            <tr key={row.hash}>
              <td>
                <Link to={`/tx/${row.hash}`} className={`mono ${styles.hash}`}>
                  {truncateMiddle(row.hash, 8, 6)}
                </Link>
              </td>
              <td>
                {row.method ? <span className={styles.method}>{row.method}</span> : <span className={styles.muted}>—</span>}
              </td>
              <td className={styles.muted}>{formatAge(txTimestamp(row))}</td>
              <td>
                {row.address ? (
                  <Link to={`/address/${row.address}#portfolios`} className={`mono ${styles.addr}`} title={row.address}>
                    {truncateMiddle(row.address, 6, 4)}
                  </Link>
                ) : "—"}
              </td>
              <td>
                {row.to_address ? (
                  <Link to={`/address/${row.to_address}#portfolios`} className={`mono ${styles.addr}`} title={row.to_address}>
                    {truncateMiddle(row.to_address, 6, 4)}
                  </Link>
                ) : <span className={styles.muted}>—</span>}
              </td>
              <td>
                <DirectionBadge direction={direction} />
              </td>
              <td className={`${styles.numeric} mono`}>
                {row.amount ? formatAmount(row.amount, decimals) : "—"}
              </td>
              <td className={styles.symbol}>{symbol}</td>
              <td className={`${styles.numeric} mono ${styles.muted}`}>{safeMomentum(row.momentum_height)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
