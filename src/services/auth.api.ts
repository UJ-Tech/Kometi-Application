// src/services/auth.api.ts
import apiClient from "./api.client";
import type { ApiResponse, User } from "../types";

export interface SendOTPPayload    { phone: string }
export interface VerifyOTPPayload  { phone: string; otp: string }
export interface LoginPayload      { email: string; phone: string; password: string }
export interface RegisterPayload   { phone: string; name: string; email: string; password: string }
export interface SetMPINPayload    { mpin: string }
export interface VerifyMPINPayload { mpin: string }
export interface SendEmailOTPPayload { email: string }
export interface VerifyEmailOTPPayload { email: string; otp: string }
export interface ChangePasswordPayload { currentPassword: string; newPassword: string }
export interface LogoutPayload { refreshToken?: string | null }

export interface MPINVerifyResponse {
  verified: boolean;
  remainingAttempts?: number;
}

export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  user:         User;
}

export interface CheckAvailabilityPayload { phone: string; email: string }

export interface CheckAvailabilityResponse {
  available: boolean;
  exists: "registered" | "pending" | null;
  field: "phone" | "email" | null;
}

export const authApi = {
  sendOTP: (payload: SendOTPPayload) =>
    apiClient.post<ApiResponse<{ expiresIn: number }>>("/auth/send-otp", payload),

  verifyOTP: (payload: VerifyOTPPayload) =>
    apiClient.post<ApiResponse<AuthTokens>>("/auth/verify-otp", payload),

  login: (payload: LoginPayload) =>
    apiClient.post<ApiResponse<AuthTokens>>("/auth/login", payload),

  register: (payload: RegisterPayload) =>
    apiClient.post<ApiResponse<AuthTokens>>("/auth/register", payload),

  refreshToken: (refreshToken: string) =>
    apiClient.post<ApiResponse<{ accessToken: string }>>("/auth/refresh", { refreshToken }),

  logout: (payload?: LogoutPayload) =>
    apiClient.post<ApiResponse<null>>("/auth/logout", payload ?? {}),

  setMPIN: (payload: SetMPINPayload) =>
    apiClient.post<ApiResponse<null>>("/auth/set-mpin", payload),

  verifyMPIN: (payload: VerifyMPINPayload) =>
    apiClient.post<ApiResponse<MPINVerifyResponse>>("/auth/verify-mpin", payload),

  getMe: () =>
    apiClient.get<ApiResponse<User>>("/auth/me"),

  changePassword: (payload: ChangePasswordPayload) =>
    apiClient.put<ApiResponse<null>>("/auth/change-password", payload),

  sendEmailOTP: (payload: SendEmailOTPPayload) =>
    apiClient.post<ApiResponse<null>>("/auth/send-email-otp", payload),

  verifyEmailOTP: (payload: VerifyEmailOTPPayload) =>
    apiClient.post<ApiResponse<{ verified: boolean }>>("/auth/verify-email-otp", payload),

  checkAvailability: (payload: CheckAvailabilityPayload) =>
    apiClient.post<ApiResponse<CheckAvailabilityResponse>>("/auth/check-availability", payload),

  cancelRegistration: () =>
    apiClient.post<ApiResponse<null>>("/auth/cancel-registration"),
};
