// src/services/members.api.ts
import apiClient from "./api.client";
import type { ApiResponse, User, KYCDocument, PaginationMeta } from "../types";

export interface MembersListParams {
  page?:   number;
  limit?:  number;
  search?: string;
}

export interface UpdateMemberPayload {
  name?:  string;
  email?: string;
}

export interface UploadKYCPayload {
  aadhaarNum?: string;
  panNum?:     string;
  aadhaarUrl?: string;
  panUrl?:     string;
  selfieUrl?:  string;
}

export const membersApi = {
  list: (params?: MembersListParams) =>
    apiClient.get<ApiResponse<User[]> & { meta: PaginationMeta }>("/members", { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<User>>(`/members/${id}`),

  update: (id: string, payload: UpdateMemberPayload) =>
    apiClient.put<ApiResponse<User>>(`/members/${id}`, payload),

  getKYC: (id: string) =>
    apiClient.get<ApiResponse<KYCDocument>>(`/members/${id}/kyc`),

  uploadKYC: (id: string, payload: UploadKYCPayload) =>
    apiClient.post<ApiResponse<KYCDocument>>(`/members/${id}/kyc`, payload),

  updateKYCStatus: (id: string, status: "VERIFIED" | "REJECTED", reason?: string) =>
    apiClient.put<ApiResponse<KYCDocument>>(`/members/${id}/kyc/status`, { status, rejectedReason: reason }),

  getPresignedUrl: (fileType: "aadhaar" | "pan" | "selfie") =>
    apiClient.get<ApiResponse<{ uploadUrl: string; fileUrl: string }>>(`/members/presigned-url?type=${fileType}`),
};
