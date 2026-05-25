import { Suspense } from "react";
import { Outlet } from "react-router-dom";

export function PageSuspense() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--color-muted)" }}>Loading...</div>}>
      <Outlet />
    </Suspense>
  );
}
