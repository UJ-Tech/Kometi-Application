// src/services/admin.api.ts
import apiClient from "./api.client";
import type { ApiResponse, User, UserRole } from "../types";

export interface MonthlyAnalytic {
  month: string;
  collectionPaise: number;
  profitPaise: number;
}

export interface CommitteeSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  totalSlots: number;
  filledSlots: number;
  installmentAmountPaise: number;
  organizer: { name: string; phone: string };
}

export interface WalletSummary {
  id: string;
  userId: string;
  balancePaise: number;
  user: { name: string; phone: string; role: string };
}

export interface AdminDashboardStats {
  totalCollectionPaise: number;
  pendingPaymentsPaise: number;
  activeCommitteesCount: number;
  profitOverviewPaise: number;
  monthlyAnalytics: MonthlyAnalytic[];
  totalUsersCount: number;
  userStats: Record<string, number>;
  committeeStats: Record<string, number>;
  installmentStats: Record<string, number>;
  recentTransactions: any[];
  allCommittees: CommitteeSummary[];
  wallets: WalletSummary[];
  totalWalletBalancePaise: number;
}

export const adminApi = {
  getDashboardStats: () =>
    apiClient.get<ApiResponse<AdminDashboardStats>>("/admin/dashboard-stats"),

  updateUserRole: (userId: string, role: UserRole) =>
    apiClient.put<ApiResponse<User>>(`/admin/users/${userId}/role`, { role }),
};
