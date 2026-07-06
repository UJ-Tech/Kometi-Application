// src/services/notifications.api.ts
import apiClient from "./api.client";
import type { ApiResponse, AppNotification, PaginationMeta } from "../types";

export const notificationsApi = {
  list: (page = 1, limit = 20) =>
    apiClient.get<ApiResponse<AppNotification[]> & { meta: PaginationMeta }>(
      "/notifications",
      { params: { page, limit } }
    ),

  unreadCount: () =>
    apiClient.get<ApiResponse<{ count: number }>>("/notifications/unread-count"),

  markRead: (id: string) =>
    apiClient.put<ApiResponse<null>>(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.put<ApiResponse<null>>("/notifications/read-all"),
};
