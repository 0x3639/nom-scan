import type { Env } from "./env";
import { getNomIndexerJwt } from "./jwt";
import { UpstreamError } from "./errors";

interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: BodyInit | null;
  headers?: Record<string, string>;
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const asNumber = Number(header);
  if (Number.isFinite(asNumber)) return Math.max(0, Math.floor(asNumber));
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  }
  return null;
}

/**
 * Calls nom-indexer-go with the Bearer JWT attached. Parses JSON or
 * application/problem+json, throws UpstreamError on non-2xx.
 */
export async function nomIndexerFetch<T = unknown>(
  env: Env,
  path: string,
  opts: FetchOptions = {},
): Promise<T> {
  const jwt = await getNomIndexerJwt(env);
  const url = new URL(path, env.NOM_INDEXER_BASE_URL).toString();

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${jwt}`,
    ...opts.headers,
  };

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    body: opts.body ?? null,
    headers,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

  if (!res.ok) {
    const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
    const detail =
      body && typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail?: unknown }).detail ?? "")
        : "";
    throw new UpstreamError(
      res.status,
      `Upstream ${res.status} on ${path}${detail ? `: ${detail}` : ""}`,
      contentType.includes("problem+json") ? body : body,
      retryAfter,
    );
  }

  return body as T;
}
