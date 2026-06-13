// src/stores/auth.store.ts
import { create } from "zustand";
import type { User, KYCStatus } from "../types";
import { tokenStorage } from "../utils/storage";

interface AuthState {
  // State
  user:            User | null;
  accessToken:     string | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  kycStatus:       KYCStatus;
  pendingPhone:    string | null;  // set during OTP flow

  // Actions
  setUser:          (user: User) => void;
  setAccessToken:   (token: string) => void;
  setPendingPhone:  (phone: string) => void;
  updateKYCStatus:  (status: KYCStatus) => void;
  updateProfile:    (partial: Partial<Pick<User, "name" | "email" | "profileImageUrl">>) => void;
  logout:           () => Promise<void>;
  hydrate:          () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:            null,
  accessToken:     null,
  isAuthenticated: false,
  isLoading:       true,
  kycStatus:       "PENDING",
  pendingPhone:    null,

  setUser: (user) => {
    set({ user, isAuthenticated: true, kycStatus: user.kycStatus });
    tokenStorage.saveUser(user);
  },

  setAccessToken: (token) => {
    set({ accessToken: token });
    tokenStorage.saveAccessToken(token);
  },

  setPendingPhone: (phone) => set({ pendingPhone: phone }),

  updateKYCStatus: (status) => {
    set((state) => ({
      kycStatus: status,
      user: state.user ? { ...state.user, kycStatus: status } : null,
    }));
  },

  updateProfile: (partial) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...partial };
    set({ user: updated });
    tokenStorage.saveUser(updated);
  },

  logout: async () => {
    await tokenStorage.clearAll();
    set({
      user:            null,
      accessToken:     null,
      isAuthenticated: false,
      kycStatus:       "PENDING",
      pendingPhone:    null,
    });
  },

  hydrate: async () => {
    try {
      const [token, user] = await Promise.all([
        tokenStorage.getAccessToken(),
        tokenStorage.getUser<User>(),
      ]);
      if (token && user) {
        set({
          accessToken:     token,
          user,
          isAuthenticated: true,
          kycStatus:       user.kycStatus,
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
