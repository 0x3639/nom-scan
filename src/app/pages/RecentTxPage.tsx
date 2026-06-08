import { useSearchParams } from "react-router-dom";
import { useRecentTransactions, usePrefetchNextRecentTransactions } from "../api/queries";
import { Pagination } from "../components/Pagination";
import { PageSizeSelect } from "../components/PageSizeSelect";
import { TxTable } from "../components/tx/TxTable";
import { TxList } from "../components/tx/TxList";
import { SkeletonRows } from "../components/state/Skeleton";
import { EmptyState } from "../components/state/EmptyState";
import { ErrorState } from "../components/state/ErrorState";
import styles from "./RecentTxPage.module.css";

// Page + page-size live in the URL query string so the back button, refresh,
// and direct links all restore the user's view. The chosen size is also kept
// in localStorage so a fresh visit to /txs (no params) remembers it.
const ALLOWED_PAGE_SIZES = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_STORAGE_KEY = "nomscan.txs.pageSize";

function readStoredPageSize(): number {
  try {
    const n = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    return ALLOWED_PAGE_SIZES.includes(n) ? n : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

function parsePageSize(raw: string | null): number | null {
  const n = Number(raw);
  return ALLOWED_PAGE_SIZES.includes(n) ? n : null;
}

function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function RecentTxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get("page"));
  // Prefer an explicit ?size= param; otherwise fall back to the last-remembered
  // choice (localStorage), then the default.
  const pageSize = parsePageSize(searchParams.get("size")) ?? readStoredPageSize();
  const q = useRecentTransactions({ page, pageSize, sort: "desc" });

  const rows = q.data?.data ?? [];
  const total = q.data?.pagination?.total;
  const totalPages = typeof total === "number" ? Math.max(1, Math.ceil(total / pageSize)) : undefined;
  const hasNext = totalPages != null ? page < totalPages : rows.length === pageSize;
  const hasPrev = page > 1;
  const isStale = q.isPlaceholderData;

  usePrefetchNextRecentTransactions({ page, pageSize, sort: "desc", hasNext });

  function setPage(next: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(next));
    setSearchParams(params, { replace: true });
  }

  function changePageSize(next: number) {
    try {
      window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next));
    } catch {
      // localStorage may be unavailable (private mode); URL state still works.
    }
    const params = new URLSearchParams(searchParams);
    params.set("size", String(next));
    params.set("page", "1");
    setSearchParams(params, { replace: true });
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
