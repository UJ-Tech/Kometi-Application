import { create } from "zustand";

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  newNotificationVersion: number;
  isLoading: boolean;

  addNotification: (n: Omit<Notification, "id" | "isRead" | "createdAt">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  fetchNotifications: () => Promise<void>;
  clearUnread: () => void;
  reset: () => void;
}

let counter = 0;

export const useNotificationsStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  newNotificationVersion: 0,
  isLoading: false,

  addNotification: (n) => {
    counter += 1;
    const notif: Notification = {
      ...n,
      id: `notif_${Date.now()}_${counter}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      notifications: [notif, ...s.notifications],
      unreadCount: s.unreadCount + 1,
      newNotificationVersion: s.newNotificationVersion + 1,
    }));
  },

  markAsRead: (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
  },

  markAllAsRead: () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  fetchNotifications: async () => {
    // Notifications are pushed via socket — nothing to fetch
    return;
  },

  clearUnread: () => {
    set({ unreadCount: 0 });
  },

  reset: () => set({
    notifications: [],
    unreadCount: 0,
    newNotificationVersion: 0,
  }),
}));
