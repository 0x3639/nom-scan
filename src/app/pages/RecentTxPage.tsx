import { useState } from "react";
import { useRecentTransactions, usePrefetchNextRecentTransactions } from "../api/queries";
import { Pagination } from "../components/Pagination";
import { PageSizeSelect } from "../components/PageSizeSelect";
import { TxTable } from "../components/tx/TxTable";
import { TxList } from "../components/tx/TxList";
import { SkeletonRows } from "../components/state/Skeleton";
import { EmptyState } from "../components/state/EmptyState";
import { ErrorState } from "../components/state/ErrorState";
import styles from "./RecentTxPage.module.css";

export function RecentTxPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const q = useRecentTransactions({ page, pageSize, sort: "desc" });

  const rows = q.data?.data ?? [];
  const total = q.data?.pagination?.total;
  const totalPages = typeof total === "number" ? Math.max(1, Math.ceil(total / pageSize)) : undefined;
  const hasNext = totalPages != null ? page < totalPages : rows.length === pageSize;
  const hasPrev = page > 1;
  const isStale = q.isPlaceholderData;

  usePrefetchNextRecentTransactions({ page, pageSize, sort: "desc", hasNext });

  function changePageSize(next: number) {
    setPageSize(next);
    setPage(1);
  }

  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>Latest Transactions</h1>
        <PageSizeSelect value={pageSize} onChange={changePageSize} />
      </header>

      {q.isLoading ? (
        <SkeletonRows rows={6} height={28} />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : rows.length === 0 ? (
        <div>
          <EmptyState
            title={page === 1 ? "No transactions" : "No more transactions"}
            message={
              page === 1
                ? "The indexer has no account-blocks yet."
                : "You've reached the end of the list."
            }
          />
          {page > 1 ? <Pagination page={page} hasNext={false} hasPrev onChange={setPage} /> : null}
        </div>
      ) : (
        <div>
          {typeof total === "number" ? (
            <div className={styles.summary}>
              <span className={styles.totalLabel}>Total</span>
              <span className={`mono ${styles.totalValue}`}>{total.toLocaleString()}</span>
              <span className={styles.totalLabel}>transactions</span>
            </div>
          ) : null}
          <div aria-busy={isStale} style={{ opacity: isStale ? 0.55 : 1, transition: "opacity 120ms" }}>
            <div className={styles.tableWrap}>
              <TxTable rows={rows} />
            </div>
            <div className={styles.listWrap}>
              <TxList rows={rows} />
            </div>
          </div>
          <Pagination
            page={page}
            {...(totalPages !== undefined ? { totalPages } : { hasNext, hasPrev })}
            onChange={setPage}
          />
        </div>
      )}
    </section>
  );
}
