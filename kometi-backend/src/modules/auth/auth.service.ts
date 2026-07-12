// src/modules/auth/auth.service.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, randomInt } from "crypto";
import fs from "fs/promises";
import path from "path";
import supabase from "../../config/supabase";
import env from "../../config/env";
import { isDatabaseUnavailable } from "../../utils/db-utils";
import { sendEmailOTP } from "../../services/email.service";

type LocalUser = {
  id: string;
  phone: string;
  name: string;
  email: string;
  passwordHash: string;
  pin: string | null;
  pinAttempts: number;
  lockedUntil: string | null;
  emailVerified: boolean;
  emailVerificationCode: string | null;
  emailVerificationExpiresAt: string | null;
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

type LocalOTPRecord = {
  id: string;
  phone: string | null;
  email: string | null;
  otp: string;
  expiresAt: string;
  attempts: number;
  verified: boolean;
  createdAt: string;
};

type LocalAuthStore = {
  users: LocalUser[];
  refreshTokens: LocalRefreshToken[];
  otpVerifications: LocalOTPRecord[];
};

const localStorePath = path.resolve(process.cwd(), "data", "auth-store.json");

async function readLocalStore(): Promise<LocalAuthStore> {
  try {
    const raw = await fs.readFile(localStorePath, "utf8");
    return JSON.parse(raw) as LocalAuthStore;
  } catch {
    return { users: [], refreshTokens: [], otpVerifications: [] };
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
    return { id: user.id, phone: user.phone, isActive: user.isActive };
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

  // ─── PRE-REGISTRATION CHECKS ──────────────────────────────────────────────
  static async checkAvailability(phone: string, email: string) {
    const { data: existing } = await supabase
      .from("users")
      .select("id, phone, emailVerified")
      .or(`phone.eq.${phone},email.eq.${email}`)
      .maybeSingle();

    if (existing) {
      const field = existing.phone === phone ? "phone" : "email";
      const exists = existing.emailVerified ? "registered" : "pending";
      return { available: false, exists, field };
    }

    return { available: true, exists: null, field: null };
  }

  // ─── CANCEL PARTIAL REGISTRATION ───────────────────────────────────────────
  static async cancelRegistration(userId: string) {
    const { data: user } = await supabase
      .from("users")
      .select("emailVerified")
      .eq("id", userId)
      .single();

    if (!user) throw new Error("User not found");
    if (user.emailVerified) throw new Error("Cannot cancel: email already verified");

    await supabase.from("wallets").delete().eq("userId", userId);
    await supabase.from("users").delete().eq("id", userId);
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
        pinAttempts: 0,
        lockedUntil: null,
        emailVerified: false,
        emailVerificationCode: null,
        emailVerificationExpiresAt: null,
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

  static async verifyMpin(userId: string, mpin: string): Promise<{ verified: boolean; remainingAttempts: number }> {
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_MINUTES = 10;

    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("pin, pinAttempts, lockedUntil")
        .eq("id", userId)
        .single();

      if (error || !user || !user.pin) {
        throw new Error("MPIN not set up for this user");
      }

      const now = new Date();

      if (user.lockedUntil && new Date(user.lockedUntil) > now) {
        throw new Error("ACCOUNT_LOCKED");
      }

      if (user.lockedUntil && new Date(user.lockedUntil) <= now) {
        await supabase.from("users").update({ pinAttempts: 0, lockedUntil: null }).eq("id", userId);
      }

      const isValid = await bcrypt.compare(mpin, user.pin);

      if (!isValid) {
        const newAttempts = (user.pinAttempts ?? 0) + 1;
        const remaining = MAX_ATTEMPTS - newAttempts;

        if (remaining <= 0) {
          const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
          await supabase.from("users").update({ pinAttempts: newAttempts, lockedUntil }).eq("id", userId);
          throw new Error("ACCOUNT_LOCKED");
        }

        await supabase.from("users").update({ pinAttempts: newAttempts }).eq("id", userId);
        return { verified: false, remainingAttempts: remaining };
      }

      await supabase.from("users").update({ pinAttempts: 0, lockedUntil: null }).eq("id", userId);
      return { verified: true, remainingAttempts: MAX_ATTEMPTS };
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;

      const store = await readLocalStore();
      const user = store.users.find((u) => u.id === userId);
      if (!user || !user.pin) {
        throw new Error("MPIN not set up for this user");
      }

      const now = new Date();

      if (user.lockedUntil && new Date(user.lockedUntil) > now) {
        throw new Error("ACCOUNT_LOCKED");
      }

      if (user.lockedUntil && new Date(user.lockedUntil) <= now) {
        user.pinAttempts = 0;
        user.lockedUntil = null;
      }

      const isValid = await bcrypt.compare(mpin, user.pin);

      if (!isValid) {
        user.pinAttempts = (user.pinAttempts ?? 0) + 1;
        const remaining = MAX_ATTEMPTS - user.pinAttempts;

        if (remaining <= 0) {
          user.lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
          user.updatedAt = now.toISOString();
          await writeLocalStore(store);
          throw new Error("ACCOUNT_LOCKED");
        }

        user.updatedAt = now.toISOString();
        await writeLocalStore(store);
        return { verified: false, remainingAttempts: remaining };
      }

      user.pinAttempts = 0;
      user.lockedUntil = null;
      user.updatedAt = now.toISOString();
      await writeLocalStore(store);
      return { verified: true, remainingAttempts: MAX_ATTEMPTS };
    }
  }

  static async sendEmailOtp(userId: string, email: string): Promise<void> {
    let userName = "User";

    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("name")
        .eq("id", userId)
        .single();

      if (!userError && userData) {
        userName = userData.name;
      }
    } catch {
      const store = await readLocalStore();
      const localUser = store.users.find((u) => u.id === userId);
      if (localUser) userName = localUser.name;
    }

    const otp = randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    try {
      const { error: deleteOld } = await supabase
        .from("otp_verifications")
        .delete()
        .eq("email", email)
        .eq("verified", false);

      if (deleteOld) console.warn("Failed to clear old email OTPs:", deleteOld);

      const { error } = await supabase.from("otp_verifications").insert({
        email,
        otp: hashedOtp,
        expiresAt,
      });

      if (error) throw error;
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;

      const store = await readLocalStore();
      store.otpVerifications = store.otpVerifications.filter(
        (o) => o.email !== email || o.verified,
      );
      store.otpVerifications.push({
        id: randomUUID(),
        email,
        phone: null,
        otp: hashedOtp,
        expiresAt,
        attempts: 0,
        verified: false,
        createdAt: new Date().toISOString(),
      });
      await writeLocalStore(store);
    }

    await sendEmailOTP(email, userName, otp);
  }

  static async verifyEmailOtp(userId: string, email: string, otp: string): Promise<void> {
    try {
      const { data: verification, error } = await supabase
        .from("otp_verifications")
        .select("*")
        .eq("email", email)
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

      const { error: updateError } = await supabase
        .from("users")
        .update({
          emailVerified: true,
          emailVerificationCode: null,
          emailVerificationExpiresAt: null,
        })
        .eq("id", userId);

      if (updateError) throw updateError;
    } catch (error) {
      if (!isDatabaseUnavailable(error)) throw error;

      const store = await readLocalStore();
      const verification = store.otpVerifications.find(
        (o) => o.email === email && !o.verified && new Date(o.expiresAt) > new Date(),
      );

      if (!verification) throw new Error("Invalid or expired OTP");

      const isValid = await bcrypt.compare(otp, verification.otp);
      if (!isValid) throw new Error("Invalid or expired OTP");

      verification.verified = true;

      const user = store.users.find((u) => u.id === userId);
      if (user) {
        user.emailVerified = true;
        user.emailVerificationCode = null;
        user.emailVerificationExpiresAt = null;
        user.updatedAt = new Date().toISOString();
      }

      await writeLocalStore(store);
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
