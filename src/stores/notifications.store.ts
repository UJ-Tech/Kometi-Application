// src/stores/notifications.store.ts
import { create } from "zustand";
import type { AppNotification } from "../types";
import { notificationsApi } from "../services/notifications.api";

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  page: number;
  hasMore: boolean;
  // Socket-triggered refresh flag
  newNotificationVersion: number;

  fetchNotifications:   (reset?: boolean) => Promise<void>;
  fetchUnreadCount:     () => Promise<void>;
  markRead:             (id: string) => Promise<void>;
  markAllRead:          () => Promise<void>;
  bumpNewNotification:  () => void;
  reset:                () => void;
}

export const useNotificationsStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  page: 1,
  hasMore: false,
  newNotificationVersion: 0,

  fetchNotifications: async (reset = false) => {
    const state = get();
    if (state.isLoading && !reset) return;

    const page = reset ? 1 : state.page;
    set({ isLoading: true });

    try {
      const res = await notificationsApi.list(page, 20);
      const data = res.data.data;
      const meta = res.data.meta;

      set({
        notifications: reset ? data : [...state.notifications, ...data],
        page: page + 1,
        hasMore: meta?.hasMore || false,
        isLoading: false,
      });
    } catch (err) {
      console.error("[NotificationsStore] fetchNotifications failed:", err);
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await notificationsApi.unreadCount();
      set({ unreadCount: res.data.data.count });
    } catch (err) {
      console.error("[NotificationsStore] fetchUnreadCount failed:", err);
    }
  },

  markRead: async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch (err) {
      console.error("[NotificationsStore] markRead failed:", err);
    }
  },

  markAllRead: async () => {
    try {
      await notificationsApi.markAllRead();
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      console.error("[NotificationsStore] markAllRead failed:", err);
    }
  },

  bumpNewNotification: () => {
    set((s) => ({ newNotificationVersion: s.newNotificationVersion + 1 }));
  },

  reset: () => set({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    page: 1,
    hasMore: false,
    newNotificationVersion: 0,
  }),
}));
