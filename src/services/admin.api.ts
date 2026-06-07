// src/services/admin.api.ts
import apiClient from "./api.client";
import type { ApiResponse, User, UserRole } from "../types";

export interface MonthlyAnalytic {
  month: string;
  collectionPaise: number;
  profitPaise: number;
}

export interface AdminDashboardStats {
  totalCollectionPaise: number;
  pendingPaymentsPaise: number;
  activeCommitteesCount: number;
  profitOverviewPaise: number;
  monthlyAnalytics: MonthlyAnalytic[];
}

export const adminApi = {
  getDashboardStats: () =>
    apiClient.get<ApiResponse<AdminDashboardStats>>("/admin/dashboard-stats"),

  updateUserRole: (userId: string, role: UserRole) =>
    apiClient.put<ApiResponse<User>>(`/admin/users/${userId}/role`, { role }),
};
