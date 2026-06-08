import { useState } from "react";
import { useAddressTransactions, usePrefetchNextTransactions } from "../../api/queries";
import { Pagination } from "../Pagination";
import { DownloadCsvButton } from "./DownloadCsvButton";
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
  // Empty on any page — not just page 1. When the upstream omits pagination.total,
  // a final page that happens to be exactly full leaves Next enabled; clicking it
  // lands here. Show a graceful "no more" state with a way back instead of an
  // empty table.
  if (rowsRaw.length === 0) {
    return (
      <div>
        <EmptyState
          title={page === 1 ? "No transactions" : "No more transactions"}
          message={
            page === 1
              ? "This address has no recorded account-blocks."
              : "You've reached the end of this address's history."
          }
        />
        {page > 1 ? <Pagination page={page} hasNext={false} hasPrev onChange={setPage} /> : null}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.summaryRow}>
        {typeof total === "number" ? (
          <div className={styles.summary}>
            <span className={styles.totalLabel}>Total</span>
            <span className={`mono ${styles.totalValue}`}>{total.toLocaleString()}</span>
            <span className={styles.totalLabel}>transactions</span>
          </div>
        ) : <span />}
        <DownloadCsvButton address={address} {...(typeof total === "number" ? { txCount: total } : {})} />
      </div>
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
