// src/services/payments.api.ts
// Razorpay payment flow — order creation, verification, saved methods.

import apiClient from "./api.client";
import type { ApiResponse } from "../types";

export interface ContributionOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  razorpayKeyId: string;
  paymentTransactionId: string;
}

export interface VerifyPaymentPayload {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface SavedPaymentMethod {
  id: string;
  user_id: string;
  razorpay_contact_id: string | null;
  razorpay_fund_account_id: string | null;
  method_type: "upi" | "bank_account" | "card";
  upi_id: string | null;
  bank_account_number: string | null;
  ifsc_code: string | null;
  account_holder_name: string | null;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
}

export const paymentsApi = {
  // ─── Saved Payment Methods ───────────────────────────────────────────

  listMethods: () =>
    apiClient.get<ApiResponse<SavedPaymentMethod[]>>("/payments/methods"),

  getMethod: (methodId: string) =>
    apiClient.get<ApiResponse<SavedPaymentMethod>>(`/payments/methods/${methodId}`),

  addMethod: (payload: {
    methodType: "upi" | "bank_account" | "card";
    upiId?: string;
    bankAccountNumber?: string;
    ifscCode?: string;
    accountHolderName?: string;
  }) =>
    apiClient.post<ApiResponse<SavedPaymentMethod>>("/payments/methods", payload),

  setDefault: (methodId: string) =>
    apiClient.put<ApiResponse<{ message: string }>>(`/payments/methods/${methodId}/default`),

  deleteMethod: (methodId: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>(`/payments/methods/${methodId}`),

  // ─── Contribution Payment Flow ───────────────────────────────────────

  createContributionOrder: (committeeId: string, monthId: string, memberId: string) =>
    apiClient.post<ApiResponse<ContributionOrderResponse>>("/payments/contribution-order", {
      committeeId,
      monthId,
      memberId,
    }),

  verifyPayment: (payload: VerifyPaymentPayload) =>
    apiClient.post<ApiResponse<{ success: boolean; contribution: any }>>("/payments/verify-payment", payload),
};
