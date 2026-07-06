// src/stores/notifications.store.ts
// Socket-only notification store — tracks real-time badge count.
// No DB persistence — notifications are ephemeral (only while connected).

import { create } from "zustand";

interface NotificationState {
  unreadCount: number;
  // Socket-triggered refresh flag
  newNotificationVersion: number;

  incrementUnread:       () => void;
  clearUnread:           () => void;
  bumpNewNotification:   () => void;
  reset:                 () => void;
}

export const useNotificationsStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  newNotificationVersion: 0,

  incrementUnread: () => {
    set((s) => ({ unreadCount: s.unreadCount + 1 }));
  },

  clearUnread: () => {
    set({ unreadCount: 0 });
  },

  bumpNewNotification: () => {
    set((s) => ({
      newNotificationVersion: s.newNotificationVersion + 1,
      unreadCount: s.unreadCount + 1,
    }));
  },

  reset: () => set({
    unreadCount: 0,
    newNotificationVersion: 0,
  }),
}));
