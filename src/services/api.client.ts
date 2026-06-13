// src/services/api.client.ts
// Central Axios instance with JWT auth, token refresh, and error normalization

import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { APP_CONFIG } from "../constants/config";
import { tokenStorage } from "../utils/storage";
import { useAuthStore } from "../stores/auth.store";

// ─── Create instance ─────────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL:         APP_CONFIG.API_BASE_URL,
  timeout:         APP_CONFIG.API_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    "Accept":       "application/json",
    "X-App-Version": APP_CONFIG.version,
  },
});

// ─── Request interceptor — attach access token ───────────────────────────────

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// ─── Response interceptor — handle 401 + token refresh ──────────────────────

let isRefreshing   = false;
let refreshQueue: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            original.headers.set("Authorization", `Bearer ${token}`);
            resolve(apiClient(original));
          });
        });
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) throw new Error("NO_REFRESH_TOKEN");

        const { data } = await axios.post(
          `${APP_CONFIG.API_BASE_URL}/auth/refresh`,
          { refreshToken },
        );
        const newToken: string = data.data.accessToken;

        await tokenStorage.saveAccessToken(newToken);
        useAuthStore.getState().setAccessToken(newToken);

        onRefreshed(newToken);
        original.headers.set("Authorization", `Bearer ${newToken}`);
        return apiClient(original);
      } catch {
        await useAuthStore.getState().logout();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    // Normalize error
    const apiError = error.response?.data as { error?: string } | undefined;
    const message  = apiError?.error ?? error.message ?? "Something went wrong";
    return Promise.reject(new Error(message));
  },
);

export default apiClient;
