// src/modules/auth/auth.service.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import supabase from "../../config/supabase";
import env from "../../config/env";
import { isDatabaseUnavailable } from "../../utils/db-utils";

type LocalUser = {
  id: string;
  phone: string;
  name: string;
  email: string;
  passwordHash: string;
  pin: string | null;
  role: "ADMIN" | "MANAGER" | "ACCOUNTANT" | "AGENT" | "ORGANIZER" | "MEMBER";
  isActive: boolean;
  kycStatus: "PENDING" | "SUBMITTED" | "VERIFIED" | "REJECTED";
  profileImageUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LocalRefreshToken = {
  userId: string;
  token: string;
  expiresAt: string;
  isRevoked: boolean;
};

type LocalAuthStore = {
  users: LocalUser[];
  refreshTokens: LocalRefreshToken[];
};

const localStorePath = path.resolve(process.cwd(), "data", "auth-store.json");

async function readLocalStore(): Promise<LocalAuthStore> {
  try {
    const raw = await fs.readFile(localStorePath, "utf8");
    return JSON.parse(raw) as LocalAuthStore;
  } catch {
    return { users: [], refreshTokens: [] };
  }
}

async function writeLocalStore(store: LocalAuthStore): Promise<void> {
  await fs.mkdir(path.dirname(localStorePath), { recursive: true });
  await fs.writeFile(localStorePath, JSON.stringify(store, null, 2));
}

export class AuthService {
  private static sanitizeUser<T extends { passwordHash?: string | null }>(user: T) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private static async createAuthTokens(user: { id: string }) {
    const accessToken = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: "1d" });
    const refreshToken = jwt.sign({ id: user.id }, env.JWT_REFRESH_SECRET, { expiresIn: "30d" });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("refresh_tokens").insert({
      userId: user.id,
      token: refreshToken,
      expiresAt,
    });

    if (error) throw error;

    return { accessToken, refreshToken };
  }

  private static async createLocalAuthTokens(user: { id: string }) {
    const accessToken = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: "1d" });
    const refreshToken = jwt.sign({ id: user.id }, env.JWT_REFRESH_SECRET, { expiresIn: "30d" });
    const store = await readLocalStore();

    store.refreshTokens.push({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isRevoked: false,
    });

    await writeLocalStore(store);
    return { accessToken, refreshToken };
  }

  static async getUserForAuth(userId: string) {
    const store = await readLocalStore();
    const user = store.users.find((u) => u.id === userId && u.isActive);
    if (!user) return null;
    return { id: user.id, phone: user.phone, role: user.role, isActive: user.isActive };
  }

  static async sendOtp(phone: string): Promise<string> {
    const mockOtp = "123456";
    const hashedOtp = await bcrypt.hash(mockOtp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error } = await supabase.from("otp_verifications").insert({
      phone,
      otp: hashedOtp,
      expiresAt,
    });

    if (error) {
      if (!isDatabaseUnavailable(error)) throw error;
      console.log(`[Local Fallback] OTP saved locally for ${phone}`);
    }

    console.log(`[Demo SMS] OTP to ${phone}: ${mockOtp}`);
    return mockOtp;
  }

  static async verifyOtp(phone: string, otp: string) {
    const { data: verification, error } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("phone", phone)
      .eq("verified", false)
      .gt("expiresAt", new Date().toISOString())
      .order("createdAt", { ascending: false })
      .limit(1)
      .single();

    if (error || !verification) {
      throw new Error("Invalid or expired OTP");
    }

    const isValid = await bcrypt.compare(otp, verification.otp);
    if (!isValid) {
      throw new Error("Invalid or expired OTP");
    }

    await supabase.from("otp_verifications").update({ verified: true }).eq("id", verification.id);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .single();

    if (userError || !user) {
      return { isNewUser: true };
    }

    const tokens = await this.createAuthTokens(user);
    return { isNewUser: false, ...tokens, user: this.sanitizeUser(user) };
  }

  static async login(email: string, phone: string, password: string) {
    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .eq("phone", phone)
        .single();

      if (error || !user || !user.passwordHash) {
        throw new Error("Invalid login details");
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) {
        throw new Error("Invalid login details");
      }

      await supabase
        .from("users")
        .update({ lastLoginAt: new Date().toISOString() })
        .eq("id", user.id);

      const tokens = await this.createAuthTokens(user);
      return { ...tokens, user: this.sanitizeUser(user) };
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;

      const store = await readLocalStore();
      const user = store.users.find((u) => u.email === email && u.phone === phone);
      if (!user) throw new Error("Invalid login details");

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) throw new Error("Invalid login details");

      user.lastLoginAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
      await writeLocalStore(store);

      const tokens = await this.createLocalAuthTokens(user);
      return { ...tokens, user: this.sanitizeUser(user) };
    }
  }

  static async registerUser(phone: string, name: string, email: string, password: string) {
    let passwordHash: string | undefined;
    try {
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .or(`phone.eq.${phone},email.eq.${email}`)
        .single();

      if (existingUser) {
        throw new Error("User with this phone number or email already registered");
      }

      passwordHash = await bcrypt.hash(password, 10);

      const { data: newUser, error } = await supabase
        .from("users")
        .insert({
          phone,
          name,
          email,
          passwordHash,
          role: "MEMBER",
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from("wallets").insert({
        userId: newUser.id,
        balancePaise: 0,
      });

      const tokens = await this.createAuthTokens(newUser);
      return { user: this.sanitizeUser(newUser), ...tokens };
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;

      const store = await readLocalStore();
      const existingUser = store.users.find((u) => u.phone === phone || u.email === email);
      if (existingUser) {
        throw new Error("User with this phone number or email already registered");
      }

      const now = new Date().toISOString();
      if (!passwordHash) {
        passwordHash = await bcrypt.hash(password, 10);
      }

      const newUser: LocalUser = {
        id: randomUUID(),
        phone,
        name,
        email,
        passwordHash,
        pin: null,
        role: "MEMBER",
        isActive: true,
        kycStatus: "PENDING",
        profileImageUrl: null,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      };

      store.users.push(newUser);
      await writeLocalStore(store);

      const tokens = await this.createLocalAuthTokens(newUser);
      return { user: this.sanitizeUser(newUser), ...tokens };
    }
  }

  static async refreshAccessToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string };
      const { data: storedToken, error } = await supabase
        .from("refresh_tokens")
        .select("*")
        .eq("token", refreshToken)
        .single();

      if (error || !storedToken || storedToken.isRevoked || new Date(storedToken.expiresAt) <= new Date()) {
        throw new Error("Invalid refresh token");
      }

      const accessToken = jwt.sign({ id: decoded.id }, env.JWT_SECRET, { expiresIn: "1d" });
      return { accessToken };
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;

      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string };
      const store = await readLocalStore();
      const storedToken = store.refreshTokens.find((t) => t.token === refreshToken);
      if (!storedToken || storedToken.isRevoked || new Date(storedToken.expiresAt) <= new Date()) {
        throw new Error("Invalid refresh token");
      }

      const accessToken = jwt.sign({ id: decoded.id }, env.JWT_SECRET, { expiresIn: "1d" });
      return { accessToken };
    }
  }

  static async logout(refreshToken?: string) {
    if (!refreshToken) return;
    try {
      await supabase
        .from("refresh_tokens")
        .update({ isRevoked: true })
        .eq("token", refreshToken);
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;

      const store = await readLocalStore();
      store.refreshTokens = store.refreshTokens.map((t) => (
        t.token === refreshToken ? { ...t, isRevoked: true } : t
      ));
      await writeLocalStore(store);
    }
  }

  static async setMpin(userId: string, mpin: string) {
    const hashedMpin = await bcrypt.hash(mpin, 10);
    try {
      console.log(`[Supabase] Setting MPIN for user: ${userId}`);
      const { data, error } = await supabase
        .from("users")
        .update({ pin: hashedMpin })
        .eq("id", userId)
        .select();
      
      if (error) {
        console.error(`[Supabase Error] Failed to set MPIN:`, error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.warn(`[Supabase Warning] No user updated. Possible RLS issue for ID: ${userId}`);
      } else {
        console.log(`[Supabase Success] MPIN stored for user: ${userId}`);
      }
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;

      const store = await readLocalStore();
      const user = store.users.find((u) => u.id === userId);
      if (!user) throw new Error("User not found");
      user.pin = hashedMpin;
      user.updatedAt = new Date().toISOString();
      await writeLocalStore(store);
    }
  }

  static async setUserRole(userId: string, role: "MEMBER" | "ORGANIZER") {
    try {
      const { data, error } = await supabase
        .from("users")
        .update({ role, updatedAt: new Date().toISOString() })
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error("User not found");
      return this.sanitizeUser(data);
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;

      const store = await readLocalStore();
      const user = store.users.find((u) => u.id === userId);
      if (!user) throw new Error("User not found");
      user.role = role;
      user.updatedAt = new Date().toISOString();
      await writeLocalStore(store);
      return this.sanitizeUser(user);
    }
  }

  static async verifyMpin(userId: string, mpin: string): Promise<boolean> {
    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("pin")
        .eq("id", userId)
        .single();

      if (error || !user || !user.pin) {
        throw new Error("MPIN not set up for this user");
      }

      return bcrypt.compare(mpin, user.pin);
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;

      const store = await readLocalStore();
      const user = store.users.find((u) => u.id === userId);
      if (!user || !user.pin) {
        throw new Error("MPIN not set up for this user");
      }

      return bcrypt.compare(mpin, user.pin);
    }
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("passwordHash")
        .eq("id", userId)
        .single();

      if (error || !user || !user.passwordHash) {
        throw new Error("User not found");
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        throw new Error("Current password is incorrect");
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      const { error: updateError } = await supabase
        .from("users")
        .update({ passwordHash: newHash, updatedAt: new Date().toISOString() })
        .eq("id", userId);

      if (updateError) throw updateError;
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;

      const store = await readLocalStore();
      const user = store.users.find((u) => u.id === userId);
      if (!user) throw new Error("User not found");

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) throw new Error("Current password is incorrect");

      user.passwordHash = await bcrypt.hash(newPassword, 10);
      user.updatedAt = new Date().toISOString();
      await writeLocalStore(store);
    }
  }
}
