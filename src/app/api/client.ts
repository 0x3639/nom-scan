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
