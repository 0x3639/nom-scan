import { Link } from "react-router-dom";
import type { TxRow } from "@shared/api/nomscan";
import { txTimestamp } from "@shared/api/nomscan";
import { getDirection } from "@shared/logic/direction";
import { formatAmount } from "@shared/format/amount";
import { truncateMiddle } from "@shared/format/address";
import { formatAge } from "@shared/format/time";
import { useTokens } from "../../api/queries";
import { DirectionBadge } from "./DirectionBadge";
import styles from "./TxList.module.css";

interface Props {
  rows: TxRow[];
  viewedAddress?: string;
}

export function TxList({ rows, viewedAddress }: Props) {
  const tokens = useTokens(rows.map((r) => r.token_standard));
  return (
    <ul className={styles.list}>
      {rows.map((row) => {
        const direction = viewedAddress ? getDirection(row, viewedAddress) : "PAIR";
        const token = row.token ?? (row.token_standard ? tokens.get(row.token_standard) : undefined);
        const decimals = token?.decimals ?? 8;
        return (
          <li key={row.hash} className={styles.item}>
            <div className={styles.headRow}>
              <Link to={`/tx/${row.hash}`} className={`mono ${styles.hash}`}>
                {truncateMiddle(row.hash, 10, 6)}
              </Link>
              <DirectionBadge direction={direction} />
            </div>
            <div className={styles.amountRow}>
              <span className={`mono ${styles.amount}`}>
                {row.amount ? formatAmount(row.amount, decimals) : "—"}
              </span>
              <span className={styles.symbol}>{token?.symbol ?? ""}</span>
            </div>
            <div className={styles.meta}>
              <span>{formatAge(txTimestamp(row))}</span>
              {row.momentum_height != null ? (
                <>
                  <span className={styles.dot}>·</span>
                  <span className="mono">M {row.momentum_height.toLocaleString()}</span>
                </>
              ) : null}
              {row.method ? (
                <>
                  <span className={styles.dot}>·</span>
                  <span className={`mono ${styles.method}`}>{row.method}</span>
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
