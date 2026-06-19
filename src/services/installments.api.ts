// src/services/installments.api.ts
import apiClient from "./api.client";
import type { ApiResponse, Installment, PaginationMeta, CollectInstallmentPayload } from "../types";

export interface InstallmentListParams {
  committeeId?: string;
  userId?:      string;
  status?:      string;
  page?:        number;
  limit?:       number;
}

export const installmentsApi = {
  list: (params?: InstallmentListParams) =>
    apiClient.get<ApiResponse<Installment[]> & { meta: PaginationMeta }>("/installments", { params }),

  dueToday: () =>
    apiClient.get<ApiResponse<Installment[]>>("/installments/due-today"),

  overdue: () =>
    apiClient.get<ApiResponse<Installment[]>>("/installments/overdue"),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Installment>>(`/installments/${id}`),

  collect: (id: string, payload: CollectInstallmentPayload) =>
    apiClient.post<ApiResponse<Installment>>(`/installments/${id}/collect`, payload),

  waive: (id: string, reason: string) =>
    apiClient.post<ApiResponse<Installment>>(`/installments/${id}/waive`, { reason }),

  bulkCollect: (installments: Array<{ id: string } & CollectInstallmentPayload>) =>
    apiClient.post<ApiResponse<Installment[]>>("/installments/bulk-collect", { installments }),

  getByCommittee: (committeeId: string, params?: InstallmentListParams) =>
    apiClient.get<ApiResponse<Installment[]> & { meta: PaginationMeta }>(
      `/installments`, { params: { ...params, committeeId } }
    ),

  getByMember: (userId: string, params?: InstallmentListParams) =>
    apiClient.get<ApiResponse<Installment[]> & { meta: PaginationMeta }>(
      `/members/${userId}/installments`, { params }
    ),
};
