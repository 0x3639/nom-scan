import { keepPreviousData, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { pfscanFetch } from "./client";
import type {
  AddressSummary,
  BalanceEntry,
  MomentumDetail,
  PriceMap,
  SearchResult,
  TokenMeta,
  TxDetail,
  TxRow,
} from "@shared/api/pfscan";

export interface TxListParams {
  page?: number;
  pageSize?: number;
  sort?: "asc" | "desc";
}

const STALE = {
  status: 5_000,
  address: 30_000,
  tx: 60_000,
  token: 5 * 60_000,
  prices: 60_000,
  momentum: 5 * 60_000,
};

export function useStatus() {
  return useQuery({
    queryKey: ["status"],
    queryFn: () => pfscanFetch<Record<string, unknown>>("/api/status").then((r) => r.data),
    staleTime: STALE.status,
    refetchInterval: 10_000,
  });
}

export function useSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () =>
      pfscanFetch<SearchResult>(`/api/search?q=${encodeURIComponent(query)}`).then((r) => r.data),
    enabled,
    staleTime: 0,
  });
}

export function useAddressSummary(address: string) {
  return useQuery({
    queryKey: ["address", address, "summary"],
    queryFn: () =>
      pfscanFetch<AddressSummary>(`/api/address/${encodeURIComponent(address)}/summary`).then(
        (r) => r.data,
      ),
    staleTime: STALE.address,
    enabled: Boolean(address),
  });
}

export function useAddressBalances(address: string) {
  return useQuery({
    queryKey: ["address", address, "balances"],
    queryFn: () =>
      pfscanFetch<BalanceEntry[]>(`/api/address/${encodeURIComponent(address)}/balances`).then(
        (r) => r.data,
      ),
    staleTime: STALE.address,
    enabled: Boolean(address),
  });
}

function txListPath(address: string, page: number, pageSize: number, sort: "asc" | "desc"): string {
  return `/api/address/${encodeURIComponent(address)}/transactions?page=${page}&page_size=${pageSize}&sort=${sort}`;
}

export function useAddressTransactions(address: string, params: TxListParams) {
  const page = params.page ?? 1;
  // Default matches the Worker's DEFAULT_PAGE_SIZE (50) and TransactionsTab's
  // PAGE_SIZE so the hasNext heuristic / prefetch logic can't drift.
  const pageSize = params.pageSize ?? 50;
  const sort = params.sort ?? "desc";
  return useQuery({
    queryKey: ["address", address, "transactions", page, pageSize, sort],
    queryFn: () => pfscanFetch<TxRow[]>(txListPath(address, page, pageSize, sort)),
    staleTime: STALE.address,
    enabled: Boolean(address),
    // Keep the previous page visible while the new one loads so Next/Prev
    // feels instant on addresses with many account-blocks.
    placeholderData: keepPreviousData,
  });
}

/**
 * Warm page N+1 in the background while the user reads page N. Combined with
 * keepPreviousData above, Next click usually has zero perceived latency.
 */
export function usePrefetchNextTransactions(
  address: string,
  params: { page: number; pageSize: number; sort: "asc" | "desc"; hasNext: boolean },
) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!address || !params.hasNext) return;
    const next = params.page + 1;
    void qc.prefetchQuery({
      queryKey: ["address", address, "transactions", next, params.pageSize, params.sort],
      queryFn: () => pfscanFetch<TxRow[]>(txListPath(address, next, params.pageSize, params.sort)),
      staleTime: STALE.address,
    });
  }, [qc, address, params.page, params.pageSize, params.sort, params.hasNext]);
}

/**
 * Bulk lookup of token metadata for a set of token standards. Each standard
 * becomes its own dedup'd useQuery — so 25 rows referencing 3 unique tokens
 * fires 3 queries, not 25. Worker side is cached 24h via the Cache API.
 */
export function useTokens(standards: ReadonlyArray<string | null | undefined>): Map<string, TokenMeta> {
  const unique = Array.from(new Set(standards.filter((s): s is string => Boolean(s))));
  const results = useQueries({
    queries: unique.map((s) => ({
      queryKey: ["token", s],
      queryFn: () => pfscanFetch<TokenMeta>(`/api/tokens/${encodeURIComponent(s)}`).then((r) => r.data),
      staleTime: STALE.token,
    })),
  });
  const out = new Map<string, TokenMeta>();
  unique.forEach((s, i) => {
    const data = results[i]?.data;
    if (data) out.set(s, data);
  });
  return out;
}

export function useTransaction(hash: string) {
  return useQuery({
    queryKey: ["tx", hash],
    queryFn: () =>
      pfscanFetch<TxDetail>(`/api/tx/${encodeURIComponent(hash)}`).then((r) => r.data),
    staleTime: STALE.tx,
    enabled: Boolean(hash),
  });
}

export function usePrices() {
  return useQuery({
    queryKey: ["prices"],
    queryFn: () => pfscanFetch<PriceMap>("/api/prices").then((r) => r.data),
    staleTime: STALE.prices,
    refetchInterval: 5 * 60_000,
  });
}

export function useToken(standard: string) {
  return useQuery({
    queryKey: ["token", standard],
    queryFn: () =>
      pfscanFetch<TokenMeta>(`/api/tokens/${encodeURIComponent(standard)}`).then((r) => r.data),
    staleTime: STALE.token,
    enabled: Boolean(standard),
  });
}

export function useMomentum(height: string) {
  return useQuery({
    queryKey: ["momentum", height],
    queryFn: () =>
      pfscanFetch<MomentumDetail>(`/api/momentum/${encodeURIComponent(height)}`).then((r) => r.data),
    staleTime: STALE.momentum,
    enabled: Boolean(height),
  });
}

/**
 * Latest momentum height from the status endpoint (reused by MomentumBadge's
 * source fields). Returns null until known — used to disable "next" at the tip.
 */
export function useLatestMomentumHeight(): number | null {
  const status = useStatus();
  const d =
    status.data && typeof status.data === "object" ? (status.data as Record<string, unknown>) : null;
  const h = d ? d["latest_height"] ?? d["momentum_height"] ?? d["height"] ?? null : null;
  if (typeof h === "number") return h;
  if (typeof h === "string" && /^\d+$/.test(h)) return Number(h);
  return null;
}
