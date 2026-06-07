// src/services/wallet.api.ts
import apiClient from "./api.client";
import type { ApiResponse, Wallet, Transaction, PaginationMeta } from "../types";

export interface TransferPayload {
  toUserId:       string;
  amountPaise:    number;
  idempotencyKey: string;
  notes?:         string;
}

export interface TopupPayload {
  amountPaise:    number;
  paymentMethod:  string;
  reference?:     string;
}

export const walletApi = {
  getWallet: () =>
    apiClient.get<ApiResponse<Wallet>>("/wallet"),

  getBalance: () =>
    apiClient.get<ApiResponse<{ balancePaise: number; reservedPaise: number }>>("/wallet/balance"),

  getTransactions: (params?: { page?: number; limit?: number; category?: string }) =>
    apiClient.get<ApiResponse<Transaction[]> & { meta: PaginationMeta }>("/wallet/transactions", { params }),

  getTransaction: (id: string) =>
    apiClient.get<ApiResponse<Transaction>>(`/wallet/transactions/${id}`),

  topup: (payload: TopupPayload) =>
    apiClient.post<ApiResponse<Transaction>>("/wallet/topup", payload),

  transfer: (payload: TransferPayload) =>
    apiClient.post<ApiResponse<{ debit: Transaction; credit: Transaction }>>("/wallet/transfer", payload),

  payInstallment: (installmentId: string, idempotencyKey: string) =>
    apiClient.post<ApiResponse<Transaction>>(`/wallet/pay-installment/${installmentId}`, { idempotencyKey }),

  getStatement: (month: string) =>   // "2026-05"
    apiClient.get<ApiResponse<{ url: string }>>(`/wallet/statement?month=${month}`),
};
