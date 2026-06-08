import type { Env } from "./env";
import { ApiRouter } from "./router";
import { err } from "./respond";
import { getStatus } from "./routes/status";
import { getSearch } from "./routes/search";
import {
  getAddressSummary,
  getAddressBalances,
  getAddressTransactions,
} from "./routes/address";
import { getTransaction } from "./routes/tx";
import { getMomentum } from "./routes/momentum";
import { getTransactions } from "./routes/transactions";
import { getAddressTransactionsCsv } from "./routes/transactions-csv";
import { getTokenMeta } from "./routes/tokens";
import { getPrices } from "./routes/prices";

const api = new ApiRouter()
  .get("/api/status", getStatus)
  .get("/api/search", getSearch)
  .get("/api/transactions", getTransactions)
  .get("/api/address/:address/summary", getAddressSummary)
  .get("/api/address/:address/balances", getAddressBalances)
  .get("/api/address/:address/transactions", getAddressTransactions)
  .get("/api/address/:address/transactions.csv", getAddressTransactionsCsv)
  .get("/api/tx/:hash", getTransaction)
  .get("/api/momentum/:height", getMomentum)
  .get("/api/tokens/:standard", getTokenMeta)
  .get("/api/prices", getPrices);

const BASE_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

const PROD_CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function withSecurityHeaders(response: Response, env: Env): Response {
  // Only decorate HTML responses; JSON API responses already set their own headers.
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(BASE_SECURITY_HEADERS)) headers.set(k, v);
  // CSP only applies in production. In local dev, Vite's React Fast Refresh
  // injects an inline <script> preamble that strict CSP would block — without
  // the preamble, react-refresh throws "can't detect preamble" and React
  // never mounts. Local risk is nil (it's the developer's own machine).
  if (env.NOMSCAN_ENV === "production") {
    headers.set("Content-Security-Policy", PROD_CSP);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        const matched = await api.dispatch(request, env, ctx);
        if (matched) return matched;
        return err("not_found", "API route not found.", 404);
      } catch (e) {
        console.error("[nomscan] unhandled router error:", e);
        return err("internal", "Something went wrong.", 500);
      }
    }

    // Static assets + SPA fallback (configured in wrangler.jsonc as
    // not_found_handling: single-page-application).
    const assetResponse = await env.ASSETS.fetch(request);
    return withSecurityHeaders(assetResponse, env);
  },
};
