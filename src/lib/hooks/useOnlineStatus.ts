"use client";

import { useState, useEffect } from "react";

export interface OfflineStatus {
  isOnline: boolean;
  isOffline: boolean;
  lastOnline: Date | null;
  serviceWorkerReady: boolean;
}

export function useOnlineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
    lastOnline: null,
    serviceWorkerReady: false,
  });

  useEffect(() => {
    const updateStatus = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: navigator.onLine,
        isOffline: !navigator.onLine,
        lastOnline: navigator.onLine ? new Date() : prev.lastOnline,
      }));
    };

    // Listen for online/offline events
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    // Check service worker status
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setStatus((prev) => ({ ...prev, serviceWorkerReady: true }));
      });
    }

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  return status;
}
