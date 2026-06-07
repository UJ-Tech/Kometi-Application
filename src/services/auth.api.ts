// src/services/auth.api.ts
import apiClient from "./api.client";
import type { ApiResponse, User, UserRole } from "../types";

export interface SendOTPPayload    { phone: string }
export interface VerifyOTPPayload  { phone: string; otp: string }
export interface LoginPayload      { email: string; phone: string; password: string }
export interface RegisterPayload   { phone: string; name: string; email: string; password: string }
export interface SetMPINPayload    { mpin: string }
export interface VerifyMPINPayload { mpin: string }
export interface SetRolePayload    { role: "MEMBER" | "ORGANIZER" }
export interface ChangePasswordPayload { currentPassword: string; newPassword: string }
export interface LogoutPayload { refreshToken?: string | null }

export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  user:         User;
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
    apiClient.post<ApiResponse<{ verified: boolean }>>("/auth/verify-mpin", payload),

  getMe: () =>
    apiClient.get<ApiResponse<User>>("/auth/me"),

  setRole: (payload: SetRolePayload) =>
    apiClient.put<ApiResponse<User>>("/auth/set-role", payload),

  changePassword: (payload: ChangePasswordPayload) =>
    apiClient.put<ApiResponse<null>>("/auth/change-password", payload),
};
