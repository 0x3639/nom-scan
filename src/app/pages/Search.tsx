import { Navigate, useSearchParams } from "react-router-dom";
import { useSearch } from "../api/queries";
import { isAddress, isHash, isMomentumHeight, normalizeHash } from "@shared/validate/identifier";

export function Search() {
  const [params] = useSearchParams();
  const q = params.get("q")?.trim() ?? "";
  const search = useSearch(q, q.length > 0);

  if (!q) return <Navigate to="/" replace />;

  if (search.isLoading) {
    return <p style={{ color: "var(--color-muted)" }}>Searching for <span className="mono">{q}</span>…</p>;
  }

  if (search.isError || !search.data) {
    return (
      <div style={{ color: "var(--color-muted)" }}>
        <h1 style={{ color: "var(--color-text)", margin: "0 0 8px" }}>Search failed</h1>
        <p>Couldn't reach search for <span className="mono">{q}</span>.</p>
      </div>
    );
  }

  // Re-validate the Worker-supplied target before interpolating it into a
  // route — defense-in-depth so a buggy envelope can't inject path segments
  // or query/hash parts into the navigation.
  const { kind, target } = search.data;
  if (kind === "address" && target && isAddress(target)) {
    return <Navigate to={`/address/${target}#portfolios`} replace />;
  }
  if (kind === "tx" && target && isHash(target)) {
    return <Navigate to={`/tx/${normalizeHash(target)}`} replace />;
  }
  if (kind === "momentum" && target && isMomentumHeight(target)) {
    return <Navigate to={`/momentum/${target}`} replace />;
  }

  return (
    <div style={{ color: "var(--color-muted)" }}>
      <h1 style={{ color: "var(--color-text)", margin: "0 0 8px" }}>No results</h1>
      <p>
        Nothing matches <span className="mono" style={{ color: "var(--color-text)" }}>{q}</span>.
      </p>
      <p>Try a full Zenon address (starts with <code className="mono">z1</code>), a 64-character account-block hash, or a momentum height.</p>
    </div>
  );
}
