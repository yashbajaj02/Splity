import { useState, useEffect, useCallback } from "react";
import { getSyncQueueItems } from "@/lib/offline-db";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const items = await getSyncQueueItems();
      setPendingSyncCount(items.length);
    } catch {
      setPendingSyncCount(0);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("splity:sync_queue_updated", refreshPendingCount);
    window.addEventListener("splity:synced", refreshPendingCount);

    refreshPendingCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("splity:sync_queue_updated", refreshPendingCount);
      window.removeEventListener("splity:synced", refreshPendingCount);
    };
  }, [refreshPendingCount]);

  return { isOnline, pendingSyncCount, refreshPendingCount };
}
