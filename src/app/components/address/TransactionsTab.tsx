import { useState } from "react";
import { useAddressTransactions, usePrefetchNextTransactions } from "../../api/queries";
import { Pagination } from "../Pagination";
import { TxTable } from "../tx/TxTable";
import { TxList } from "../tx/TxList";
import { SkeletonRows } from "../state/Skeleton";
import { EmptyState } from "../state/EmptyState";
import { ErrorState } from "../state/ErrorState";
import styles from "./TransactionsTab.module.css";

const PAGE_SIZE = 50;

interface Props {
  address: string;
}

export function TransactionsTab({ address }: Props) {
  const [page, setPage] = useState(1);
  const q = useAddressTransactions(address, { page, pageSize: PAGE_SIZE, sort: "desc" });

  const rowsRaw = q.data?.data ?? [];
  const total = q.data?.pagination?.total;
  const totalPages = typeof total === "number" ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : undefined;
  const hasNext = totalPages != null ? page < totalPages : rowsRaw.length === PAGE_SIZE;
  const hasPrev = page > 1;
  const isStale = q.isPlaceholderData;

  // Warm page N+1 in the background so Next click feels instant.
  usePrefetchNextTransactions(address, { page, pageSize: PAGE_SIZE, sort: "desc", hasNext });

  if (q.isLoading) {
    return (
      <div className={styles.wrap}>
        <SkeletonRows rows={6} height={28} />
      </div>
    );
  }
  if (q.isError) return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  if (rowsRaw.length === 0 && page === 1) {
    return <EmptyState title="No transactions" message="This address has no recorded account-blocks." />;
  }

  return (
    <div>
      {typeof total === "number" ? (
        <div className={styles.summary}>
          <span className={styles.totalLabel}>Total</span>
          <span className={`mono ${styles.totalValue}`}>{total.toLocaleString()}</span>
          <span className={styles.totalLabel}>transactions</span>
        </div>
      ) : null}
      <div className={styles.tableWrap} aria-busy={isStale}>
        <div style={{ opacity: isStale ? 0.55 : 1, transition: "opacity 120ms" }}>
          <TxTable rows={rowsRaw} viewedAddress={address} />
        </div>
      </div>
      <div className={styles.listWrap} aria-busy={isStale}>
        <div style={{ opacity: isStale ? 0.55 : 1, transition: "opacity 120ms" }}>
          <TxList rows={rowsRaw} viewedAddress={address} />
        </div>
      </div>
      <Pagination
        page={page}
        {...(totalPages !== undefined ? { totalPages } : { hasNext, hasPrev })}
        onChange={setPage}
      />
    </div>
  );
}
