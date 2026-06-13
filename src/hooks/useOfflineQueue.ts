// src/hooks/useOfflineQueue.ts
// Handles queuing of failed mutation requests when offline,
// and auto-replays them once connection is restored.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../services/api.client";
import { useEffect } from "react";
import { useNetworkStatus } from "./useNetworkStatus";

export interface QueuedRequest {
  id: string;
  url: string;
  method: "POST" | "PUT" | "DELETE" | "PATCH";
  data?: any;
  headers?: any;
  timestamp: number;
}

interface OfflineQueueState {
  queue: QueuedRequest[];
  addToQueue: (request: Omit<QueuedRequest, "id" | "timestamp">) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
}

// Create a persistent store for the queue
export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set) => ({
      queue: [],
      addToQueue: (req) =>
        set((state) => ({
          queue: [
            ...state.queue,
            {
              ...req,
              id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: Date.now(),
            },
          ],
        })),
      removeFromQueue: (id) =>
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== id),
        })),
      clearQueue: () => set({ queue: [] }),
    }),
    {
      name: "kometi-offline-queue",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export function useOfflineQueue() {
  const { queue, addToQueue, removeFromQueue, clearQueue } = useOfflineQueueStore();
  const { isOnline, wasOffline, clearWasOffline } = useNetworkStatus();

  const processQueue = async () => {
    console.log(`[OfflineQueue] Processing ${queue.length} queued requests...`);
    const activeQueue = [...queue];

    for (const req of activeQueue) {
      try {
        await apiClient.request({
          url: req.url,
          method: req.method,
          data: req.data,
          headers: {
            ...req.headers,
            "X-Offline-Synced": "true",
          },
        });
        // Success: remove from store
        removeFromQueue(req.id);
        console.log(`[OfflineQueue] Replayed successfully: ${req.method} ${req.url}`);
      } catch (err: any) {
        console.error(`[OfflineQueue] Replay failed for ${req.method} ${req.url}:`, err.message);
        // If it's a 4xx client error, discard it as it won't succeed on retry
        if (err.response && err.response.status >= 400 && err.response.status < 500) {
          removeFromQueue(req.id);
        } else {
          // If it's a network/server error, stop processing to preserve order
          break;
        }
      }
    }
  };

  // Process the queue sequentially when coming back online
  useEffect(() => {
    if (isOnline && wasOffline && queue.length > 0) {
      processQueue();
      clearWasOffline();
    }
  }, [isOnline, wasOffline, queue.length]);

  return {
    queue,
    queueLength: queue.length,
    addToQueue,
    processQueue,
    clearQueue,
    isOnline,
  };
}
