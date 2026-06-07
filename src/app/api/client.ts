import type { NomScanError, NomScanPagination, NomScanResponse } from "@shared/api/nomscan";

export class NomScanFetchError extends Error {
  constructor(public readonly error: NomScanError) {
    super(error.message);
    this.name = "NomScanFetchError";
  }
}

export interface NomScanResult<T> {
  data: T;
  pagination?: NomScanPagination;
}

/**
 * True when a thrown query error is a Worker `not_found` (404). Detail pages use
 * this to render their dedicated NotFoundState instead of the generic ErrorState,
 * since nomscanFetch throws on `{ ok: false }` and a 404 otherwise lands in isError.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof NomScanFetchError && error.error.code === "not_found";
}

/**
 * Fetch a `/api/*` endpoint and unwrap the NomScan envelope. Throws
 * NomScanFetchError on `{ ok: false }`.
 */
export async function nomscanFetch<T>(path: string, init?: RequestInit): Promise<NomScanResult<T>> {
  const res = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  let body: NomScanResponse<T> | null = null;
  try {
    body = (await res.json()) as NomScanResponse<T>;
  } catch {
    body = null;
  }
  if (!body) {
    throw new NomScanFetchError({
      code: "internal",
      message: `Unparseable response from ${path}`,
      status: res.status,
    });
  }
  if (!body.ok) {
    throw new NomScanFetchError(body.error);
  }
  return { data: body.data, ...(body.pagination ? { pagination: body.pagination } : {}) };
}
