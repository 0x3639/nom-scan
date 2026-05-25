import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div style={{ textAlign: "center", padding: "64px 16px", color: "var(--color-muted)" }}>
      <h1 style={{ fontSize: 28, margin: "0 0 8px", color: "var(--color-text)" }}>Not found</h1>
      <p style={{ margin: "0 0 16px" }}>That page doesn't exist on NoM Scan.</p>
      <Link to="/" style={{ color: "var(--color-success)" }}>← Back to search</Link>
    </div>
  );
}
