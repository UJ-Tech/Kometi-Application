// src/utils/storage.ts
// Secure wrapper around expo-secure-store with an AsyncStorage fallback.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { APP_CONFIG } from "../constants/config";

let secureStoreAvailable: Promise<boolean> | null = null;

async function canUseSecureStore(): Promise<boolean> {
  secureStoreAvailable ??= SecureStore.isAvailableAsync().catch(() => false);
  return secureStoreAvailable;
}

// Secure storage for tokens and secrets.

export const secureStorage = {
  async set(key: string, value: string): Promise<void> {
    if (await canUseSecureStore()) {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      return;
    }

    await AsyncStorage.setItem(key, value);
  },

  async get(key: string): Promise<string | null> {
    if (await canUseSecureStore()) {
      return SecureStore.getItemAsync(key);
    }

    return AsyncStorage.getItem(key);
  },

  async remove(key: string): Promise<void> {
    if (await canUseSecureStore()) {
      await SecureStore.deleteItemAsync(key);
      return;
    }

    await AsyncStorage.removeItem(key);
  },

  async clear(keys: string[]): Promise<void> {
    if (await canUseSecureStore()) {
      await Promise.all(keys.map((k) => SecureStore.deleteItemAsync(k)));
      return;
    }

    await Promise.all(keys.map((k) => AsyncStorage.removeItem(k)));
  },
};

// Typed token helpers.

export const tokenStorage = {
  async saveAccessToken(token: string): Promise<void> {
    await secureStorage.set(APP_CONFIG.ACCESS_TOKEN_KEY, token);
  },

  async getAccessToken(): Promise<string | null> {
    return secureStorage.get(APP_CONFIG.ACCESS_TOKEN_KEY);
  },

  async saveRefreshToken(token: string): Promise<void> {
    await secureStorage.set(APP_CONFIG.REFRESH_TOKEN_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return secureStorage.get(APP_CONFIG.REFRESH_TOKEN_KEY);
  },

  async saveUser(user: object): Promise<void> {
    await secureStorage.set(APP_CONFIG.USER_KEY, JSON.stringify(user));
  },

  async getUser<T = unknown>(): Promise<T | null> {
    const raw = await secureStorage.get(APP_CONFIG.USER_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async clearAll(): Promise<void> {
    await secureStorage.clear([
      APP_CONFIG.ACCESS_TOKEN_KEY,
      APP_CONFIG.REFRESH_TOKEN_KEY,
      APP_CONFIG.USER_KEY,
    ]);
  },
};

// Non-sensitive fast storage.

type Value = string | number | boolean | object | null;
const memCache = new Map<string, string>();

export const fastStorage = {
  set(key: string, value: Value): void {
    memCache.set(key, JSON.stringify(value));
  },

  get<T = unknown>(key: string): T | null {
    const raw = memCache.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  remove(key: string): void {
    memCache.delete(key);
  },

  clear(): void {
    memCache.clear();
  },
};
