import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions, QueryKey } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getCachedData, getWarmCache } from "@/lib/offline-db";

/**
 * useCachedQuery
 *
 * Drop-in replacement for `useQuery` that implements cache-first,
 * background-refresh using the existing IndexedDB offline cache.
 *
 * Flow:
 *  1. First-ever load (no cache)  → no placeholderData; React Query shows its
 *     normal loading / skeleton state. Supabase is always the source of truth.
 *  2. Warm load, same session     → placeholderData served synchronously from
 *     the in-memory warm cache (populated by earlier getCachedData calls).
 *     Query is immediately marked stale; Supabase fetch continues in background.
 *  3. Warm load, new session      → one-time async IDB bootstrap on mount
 *     injects cached value into the React Query cache with updatedAt=0 so it
 *     is treated as maximally stale and the background fetch still fires.
 *  4. Background refresh done     → React Query updates the component normally;
 *     api.ts setCachedData calls keep IndexedDB in sync (no double-write here).
 *  5. Realtime invalidation       → use-supabase-realtime calls
 *     queryClient.invalidateQueries(...) which triggers a background refetch
 *     while the cached value remains visible. Unaffected by this hook.
 *
 * The hook does NOT write to IndexedDB — that stays in api.ts.
 *
 * @param cacheKey  The IndexedDB key used by the corresponding api.ts function
 *                  (e.g. "profile:${userId}", "groups:${userId}").
 * @param options   Standard React Query UseQueryOptions.
 */
export function useCachedQuery<
  TData,
  TError = Error,
  TQueryKey extends QueryKey = QueryKey,
>(
  cacheKey: string,
  options: UseQueryOptions<TData, TError, TData, TQueryKey>,
) {
  const queryClient = useQueryClient();
  const bootstrapped = useRef(false);

  // ── Synchronous warm-cache read (same page session, zero latency) ─────────
  // getWarmCache() returns data only when getCachedData (or setCachedData) has
  // already been called this session — e.g. on a second navigation to this
  // page, or after the first load completed. No async overhead.
  const warmData = getWarmCache<TData>(cacheKey);

  // ── One-time async IDB bootstrap (cold start / new session) ──────────────
  // On first mount when warmData is empty, do a single async IDB read.
  // If it resolves before the Supabase response we inject it as placeholder
  // data (updatedAt=0 → maximally stale → background fetch continues).
  // If Supabase responded first the state will have real data and we skip.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    if (warmData !== undefined) {
      // warm cache has data; IDB bootstrap not needed
      return;
    }

    getCachedData<TData>(cacheKey)
      .then((cached) => {
        if (cached == null) return;

        const state = queryClient.getQueryState(options.queryKey as QueryKey);
        // Only inject when no real data has arrived yet from the server
        if (state?.status === "pending" || state?.data == null) {
          queryClient.setQueryData(options.queryKey as QueryKey, cached, {
            // updatedAt=0 marks the entry as maximally stale so React Query
            // keeps the background fetch running and won't skip it.
            updatedAt: 0,
          });
        }
      })
      .catch(() => {
        // IDB failure is non-fatal; Supabase fetch is already in-flight
      });

    // cacheKey is intentionally the only dep: it encodes all identity info
    // (userId, groupId, …). Re-running on queryKey array changes is not needed
    // because cacheKey already changes when the identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return useQuery<TData, TError, TData, TQueryKey>({
    ...options,
    // placeholderData: the synchronous warm-cache value (if available).
    // React Query shows this immediately while the background fetch runs,
    // and replaces it with server data when the fetch completes.
    // When warmData is undefined (first ever load) we fall through to
    // whatever the caller supplied, preserving the normal skeleton state.
    placeholderData: warmData !== undefined
      ? warmData
      : (options as any).placeholderData,
  });
}
