import { useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import styles from "./Pagination.module.css";

interface Props {
  page: number;
  /** Total pages, if known (derived from pagination.total). Enables First/Last + jump-to-page. */
  totalPages?: number;
  /** Used only when totalPages is unknown. */
  hasNext?: boolean;
  hasPrev?: boolean;
  onChange: (next: number) => void;
}

export function Pagination({ page, totalPages, hasNext, hasPrev, onChange }: Props) {
  const knowsTotal = typeof totalPages === "number" && totalPages > 0;
  const canPrev = knowsTotal ? page > 1 : !!hasPrev;
  const canNext = knowsTotal ? page < (totalPages as number) : !!hasNext;

  // Track the jump-to-page input separately from `page` so users can type
  // freely. Reset whenever the active page changes from outside.
  const [jump, setJump] = useState(String(page));
  useEffect(() => { setJump(String(page)); }, [page]);

  function submitJump(e: FormEvent) {
    e.preventDefault();
    const n = Number.parseInt(jump, 10);
    if (!Number.isFinite(n) || n < 1) return;
    const clamped = knowsTotal ? Math.min(n, totalPages as number) : n;
    if (clamped !== page) onChange(clamped);
  }

  return (
    <nav className={styles.wrap} aria-label="Pagination">
      {knowsTotal ? (
        <button
          className={styles.btn}
          disabled={!canPrev}
          onClick={() => onChange(1)}
          aria-label="First page"
          title="First page"
        >
          <ChevronsLeft size={14} aria-hidden />
        </button>
      ) : null}

      <button
        className={styles.btn}
        disabled={!canPrev}
        onClick={() => onChange(Math.max(1, page - 1))}
      >
        <ChevronLeft size={14} aria-hidden /> Prev
      </button>

      {knowsTotal ? (
        <form className={styles.pageForm} onSubmit={submitJump}>
          <span className={styles.pageOf}>Page</span>
          <input
            className={`${styles.pageInput} mono`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={`Page number, of ${totalPages}`}
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))}
            onBlur={submitJump}
          />
          <span className={styles.pageOf}>of {(totalPages as number).toLocaleString()}</span>
        </form>
      ) : (
        <span className={styles.page}>Page {page}</span>
      )}

      <button
        className={styles.btn}
        disabled={!canNext}
        onClick={() => onChange(page + 1)}
      >
        Next <ChevronRight size={14} aria-hidden />
      </button>

      {knowsTotal ? (
        <button
          className={styles.btn}
          disabled={!canNext}
          onClick={() => onChange(totalPages as number)}
          aria-label="Last page"
          title="Last page"
        >
          <ChevronsRight size={14} aria-hidden />
        </button>
      ) : null}
    </nav>
  );
}
