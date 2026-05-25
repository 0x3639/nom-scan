import { createBrowserRouter, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import { RootLayout } from "./layout/RootLayout";

const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const AddressPage = lazy(() => import("./pages/AddressPage").then((m) => ({ default: m.AddressPage })));
const TxPage = lazy(() => import("./pages/TxPage").then((m) => ({ default: m.TxPage })));
const Search = lazy(() => import("./pages/Search").then((m) => ({ default: m.Search })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));
const ComingSoon = lazy(() => import("./pages/ComingSoon").then((m) => ({ default: m.ComingSoon })));

function PageSuspense() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "var(--color-muted)" }}>Loading…</div>}>
      <Outlet />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <PageSuspense />,
        children: [
          { path: "/", element: <Home /> },
          { path: "/search", element: <Search /> },
          { path: "/address/:address", element: <AddressPage /> },
          { path: "/tx/:hash", element: <TxPage /> },
          { path: "/login", element: <ComingSoon title="Login" /> },
          { path: "/account", element: <ComingSoon title="Account" /> },
          { path: "/account/watchlist", element: <ComingSoon title="Watchlist" /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);
