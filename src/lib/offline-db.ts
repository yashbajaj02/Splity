/**
 * Splity Offline Database & Sync Queue
 * Native zero-dependency IndexedDB storage with 3-month data retention
 * and 30-second background sync queue with backoff retry.
 */

const DB_NAME = "splity_offline_db";
const DB_VERSION = 1;
const CACHE_STORE = "data_cache";
const SYNC_QUEUE_STORE = "sync_queue";
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 3 months

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  updatedAt: number;
}

export interface SyncQueueItem {
  id: string;
  action: "add_expense" | "send_message" | "mark_paid";
  payload: any;
  createdAt: number;
  retries: number;
  lastAttempt?: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// In-memory warm cache: populated on first IndexedDB read so that subsequent
// synchronous reads (for React Query placeholderData) don't need an async IDB
// round-trip. This is module-level state — safe for the lifetime of the page.
// ─────────────────────────────────────────────────────────────────────────────
const warmCache = new Map<string, { data: any; updatedAt: number }>();

/**
 * Synchronous read from the in-memory warm cache populated by previous
 * `getCachedData` calls. Returns `undefined` if the key has never been read
 * from IndexedDB in this page session, or if the 3-month TTL has passed.
 */
export function getWarmCache<T>(key: string): T | undefined {
  const entry = warmCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.updatedAt > RETENTION_MS) {
    warmCache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function getDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB not supported in this environment"));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          const queueStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: "id" });
          queueStore.createIndex("createdAt", "createdAt", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Data Cache (Groups, Expenses, Activity, Settlements, Chat, Profile)
// ─────────────────────────────────────────────────────────────────────────────

export async function setCachedData<T>(key: string, data: T): Promise<void> {
  try {
    const now = Date.now();
    // Keep warm cache in sync immediately so subsequent synchronous reads are fresh
    warmCache.set(key, { data, updatedAt: now });
    const db = await getDb();
    const tx = db.transaction(CACHE_STORE, "readwrite");
    const store = tx.objectStore(CACHE_STORE);
    const entry: CacheEntry<T> = {
      key,
      data,
      updatedAt: now,
    };
    store.put(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Failed to cache:", key, err);
  }
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    const tx = db.transaction(CACHE_STORE, "readonly");
    const store = tx.objectStore(CACHE_STORE);
    const request = store.get(key);

    const result = await new Promise<CacheEntry<T> | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!result) return null;

    // Check 3-month retention
    if (Date.now() - result.updatedAt > RETENTION_MS) {
      deleteCachedData(key).catch(() => {});
      warmCache.delete(key);
      return null;
    }

    // Populate warm cache so getWarmCache() can serve synchronous reads
    warmCache.set(key, { data: result.data, updatedAt: result.updatedAt });
    return result.data;
  } catch (err) {
    console.warn("[IndexedDB] Failed to read cache:", key, err);
    return null;
  }
}

export async function deleteCachedData(key: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(CACHE_STORE, "readwrite");
    tx.objectStore(CACHE_STORE).delete(key);
  } catch (err) {
    console.warn("[IndexedDB] Failed to delete cache:", key, err);
  }
}

/** Prunes items older than 3 months */
export async function pruneExpiredCache(): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(CACHE_STORE, "readwrite");
    const store = tx.objectStore(CACHE_STORE);
    const request = store.openCursor();

    const cutoff = Date.now() - RETENTION_MS;
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const entry = cursor.value as CacheEntry;
        if (entry.updatedAt < cutoff) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch (err) {
    console.warn("[IndexedDB] Cache pruning failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Offline Sync Queue (Write operations)
// ─────────────────────────────────────────────────────────────────────────────

export async function enqueueSyncAction(
  action: SyncQueueItem["action"],
  payload: any
): Promise<string> {
  const db = await getDb();
  const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
  const store = tx.objectStore(SYNC_QUEUE_STORE);

  const item: SyncQueueItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action,
    payload,
    createdAt: Date.now(),
    retries: 0,
  };

  store.put(item);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Notify listeners
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("splity:sync_queue_updated"));
  }

  return item.id;
}

export async function getSyncQueueItems(): Promise<SyncQueueItem[]> {
  try {
    const db = await getDb();
    const tx = db.transaction(SYNC_QUEUE_STORE, "readonly");
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
    tx.objectStore(SYNC_QUEUE_STORE).delete(id);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("splity:sync_queue_updated"));
    }
  } catch (err) {
    console.warn("[IndexedDB] Failed to remove sync item:", id, err);
  }
}

export async function updateSyncItemRetry(id: string, retries: number): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(SYNC_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      const item = request.result as SyncQueueItem;
      if (item) {
        item.retries = retries;
        item.lastAttempt = Date.now();
        store.put(item);
      }
    };
  } catch (err) {
    console.warn("[IndexedDB] Failed to update sync retry:", id, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Background Sync Runner (Runs silently every 30s when online)
// ─────────────────────────────────────────────────────────────────────────────

let syncRunnerStarted = false;

export function startBackgroundSync(
  executor: (item: SyncQueueItem) => Promise<boolean>
) {
  if (syncRunnerStarted || typeof window === "undefined") return;
  syncRunnerStarted = true;

  // Run periodic cleanup of expired 3-month cache
  pruneExpiredCache().catch(() => {});

  const runSync = async () => {
    if (!navigator.onLine) return;

    try {
      const items = await getSyncQueueItems();
      if (items.length === 0) return;

      for (const item of items) {
        // Exponential backoff check: retry interval = min(60s, 2^retries * 2s)
        if (item.retries > 0 && item.lastAttempt) {
          const waitMs = Math.min(60_000, Math.pow(2, item.retries) * 2000);
          if (Date.now() - item.lastAttempt < waitMs) {
            continue;
          }
        }

        try {
          const success = await executor(item);
          if (success) {
            await removeSyncQueueItem(item.id);
            window.dispatchEvent(new CustomEvent("splity:synced", { detail: item }));
          } else {
            await updateSyncItemRetry(item.id, item.retries + 1);
          }
        } catch {
          await updateSyncItemRetry(item.id, item.retries + 1);
        }
      }
    } catch (err) {
      console.warn("[BackgroundSync] Error executing sync:", err);
    }
  };

  // Run immediately if online
  if (navigator.onLine) {
    runSync();
  }

  // Silent timer every 30 seconds
  setInterval(runSync, 30_000);

  // Also trigger immediately when network comes back online
  window.addEventListener("online", () => {
    setTimeout(runSync, 1000);
  });
}
