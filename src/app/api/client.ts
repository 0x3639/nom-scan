import type { PFScanError, PFScanPagination, PFScanResponse } from "@shared/api/pfscan";

export class PFScanFetchError extends Error {
  constructor(public readonly error: PFScanError) {
    super(error.message);
    this.name = "PFScanFetchError";
  }
}

export interface PFScanResult<T> {
  data: T;
  pagination?: PFScanPagination;
}

/**
 * True when a thrown query error is a Worker `not_found` (404). Detail pages use
 * this to render their dedicated NotFoundState instead of the generic ErrorState,
 * since pfscanFetch throws on `{ ok: false }` and a 404 otherwise lands in isError.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof PFScanFetchError && error.error.code === "not_found";
}

/**
 * Fetch a `/api/*` endpoint and unwrap the PFScan envelope. Throws
 * PFScanFetchError on `{ ok: false }`.
 */
export async function pfscanFetch<T>(path: string, init?: RequestInit): Promise<PFScanResult<T>> {
  const res = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  let body: PFScanResponse<T> | null = null;
  try {
    body = (await res.json()) as PFScanResponse<T>;
  } catch {
    body = null;
  }
  if (!body) {
    throw new PFScanFetchError({
      code: "internal",
      message: `Unparseable response from ${path}`,
      status: res.status,
    });
  }
  if (!body.ok) {
    throw new PFScanFetchError(body.error);
  }
  return { data: body.data, ...(body.pagination ? { pagination: body.pagination } : {}) };
}
