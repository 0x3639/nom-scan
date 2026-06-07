import type { NomScanErrorCode, NomScanPagination, NomScanResponse } from "@shared/api/nomscan";
import { UpstreamError, mapUpstreamStatus } from "./errors";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  // Defense-in-depth: API JSON bypasses the HTML-only security-header wrapper
  // in index.ts, so set these directly on every API response.
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export function ok<T>(data: T, pagination?: NomScanPagination, init?: ResponseInit): Response {
  const body: NomScanResponse<T> = pagination
    ? { ok: true, data, pagination }
    : { ok: true, data };
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init?.headers ?? {}) },
  });
}

export function err(
  code: NomScanErrorCode,
  message: string,
  status: number,
  retryAfter?: number,
): Response {
  const body: NomScanResponse<never> = {
    ok: false,
    error: {
      code,
      message,
      status,
      ...(retryAfter !== undefined ? { retryAfter } : {}),
    },
  };
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (retryAfter !== undefined) {
    headers["Retry-After"] = String(retryAfter);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Convert any thrown value from a route handler into a NomScanResponse error reply.
 * Logs the real error server-side and returns a user-safe message.
 */
export function errorFromThrown(thrown: unknown): Response {
  if (thrown instanceof UpstreamError) {
    const { code, userMessage } = mapUpstreamStatus(thrown.status);
    console.error(`[nomscan] upstream ${thrown.status}:`, thrown.message);
    return err(code, userMessage, thrown.status, thrown.retryAfterSeconds ?? undefined);
  }
  console.error("[nomscan] internal error:", thrown);
  return err("internal", "Something went wrong.", 500);
}
