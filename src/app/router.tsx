import { createBrowserRouter } from "react-router-dom";
import { lazy } from "react";
import { RootLayout } from "./layout/RootLayout";
import { PageSuspense } from "./layout/PageSuspense";

const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const AddressPage = lazy(() => import("./pages/AddressPage").then((m) => ({ default: m.AddressPage })));
const TxPage = lazy(() => import("./pages/TxPage").then((m) => ({ default: m.TxPage })));
const RecentTxPage = lazy(() => import("./pages/RecentTxPage").then((m) => ({ default: m.RecentTxPage })));
const MomentumPage = lazy(() => import("./pages/MomentumPage").then((m) => ({ default: m.MomentumPage })));
const Search = lazy(() => import("./pages/Search").then((m) => ({ default: m.Search })));
const NotFound = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.NotFound })));
const ComingSoon = lazy(() => import("./pages/ComingSoon").then((m) => ({ default: m.ComingSoon })));

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
          { path: "/txs", element: <RecentTxPage /> },
          { path: "/momentum/:height", element: <MomentumPage /> },
          { path: "/login", element: <ComingSoon title="Login" /> },
          { path: "/account", element: <ComingSoon title="Account" /> },
          { path: "/account/watchlist", element: <ComingSoon title="Watchlist" /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);
