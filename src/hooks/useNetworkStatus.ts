// src/hooks/useNetworkStatus.ts
// Monitors network connectivity and exposes isOnline state.
// Falls back gracefully when @react-native-community/netinfo is unavailable.

import { useState, useEffect } from "react";

export function useNetworkStatus() {
  const [isOnline,    setIsOnline]    = useState(true);
  const [wasOffline,  setWasOffline]  = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setup = async () => {
      try {
        const NetInfo = await import("@react-native-community/netinfo");
        // Set initial state
        const state = await NetInfo.default.fetch();
        setIsOnline(!!state.isConnected);

        unsubscribe = NetInfo.default.addEventListener((state) => {
          const online = !!state.isConnected;
          setIsOnline((prev) => {
            if (!prev && online) setWasOffline(true);
            return online;
          });
        });
      } catch {
        // NetInfo not installed — assume online
        setIsOnline(true);
      }
    };

    setup();
    return () => unsubscribe?.();
  }, []);

  // Clear "was offline" flag after consumer acknowledges
  const clearWasOffline = () => setWasOffline(false);

  return { isOnline, wasOffline, clearWasOffline };
}
