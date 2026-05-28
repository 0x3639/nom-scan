import { useAddressBalances, usePrices } from "../../api/queries";
import { formatAmount } from "@shared/format/amount";
import { formatUsd, rawToNumber } from "@shared/format/money";
import { truncateMiddle } from "@shared/format/address";
import { priceFeedKey } from "@shared/constants/price-aliases";
import { SkeletonRows } from "../state/Skeleton";
import { EmptyState } from "../state/EmptyState";
import { ErrorState } from "../state/ErrorState";
import styles from "./PortfolioTab.module.css";

interface Props {
  address: string;
}

function priceForSymbol(prices: Record<string, number> | undefined, symbol: string | undefined): number | null {
  const key = priceFeedKey(symbol ?? null);
  if (!prices || !key) return null;
  const p = prices[key];
  return typeof p === "number" && Number.isFinite(p) ? p : null;
}

export function PortfolioTab({ address }: Props) {
  const q = useAddressBalances(address);
  const prices = usePrices();

  if (q.isLoading) {
    return (
      <div className={styles.wrap}>
        <SkeletonRows rows={4} height={32} />
      </div>
    );
  }
  if (q.isError) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const balances = q.data ?? [];
  if (balances.length === 0) {
    return <EmptyState title="No tokens" message="This address has no recorded token balances." />;
  }

  let portfolioUsd = 0;
  let anyPriced = false;

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Token</th>
            <th>Symbol</th>
            <th>Balance</th>
            <th>Value (USD)</th>
            <th>Token Standard</th>
          </tr>
        </thead>
        <tbody>
          {balances.map((b, idx) => {
            const decimals = b.token?.decimals ?? 8;
            const symbol = b.token?.symbol;
            const price = priceForSymbol(prices.data, symbol);
            const value = price != null ? rawToNumber(b.balance, decimals) * price : null;
            if (value != null) {
              portfolioUsd += value;
              anyPriced = true;
            }
            return (
              <tr key={`${b.token_standard}-${idx}`}>
                <td data-label="Token">{b.token?.name ?? "—"}</td>
                <td data-label="Symbol" className={styles.symbol}>{symbol ?? "—"}</td>
                <td data-label="Balance" className="mono">{formatAmount(b.balance, decimals)}</td>
                <td data-label="Value (USD)" className="mono">
                  {value != null ? (
                    formatUsd(value)
                  ) : prices.isLoading ? (
                    <span className={styles.muted}>…</span>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
                <td data-label="Token Standard" className={`mono ${styles.standard}`} title={b.token_standard}>
                  {truncateMiddle(b.token_standard, 10, 6)}
                </td>
              </tr>
            );
          })}
          {anyPriced ? (
            <tr className={styles.totalRow}>
              <td colSpan={3} className={styles.totalLabel}>Portfolio total</td>
              <td className={`mono ${styles.totalValue}`}>{formatUsd(portfolioUsd)}</td>
              <td />
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className={styles.note}>
        Prices from <a href="https://api.zenon.info/price" rel="noreferrer noopener" target="_blank">api.zenon.info</a>.
        Stakes, plasma fusions, rewards, and bridge wraps/unwraps will land in a later release.
      </p>
    </div>
  );
}
