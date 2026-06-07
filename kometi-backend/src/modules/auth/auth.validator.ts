// src/modules/auth/auth.validator.ts
import { z } from "zod";

export const sendOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian phone number starting with 6-9"),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian phone number"),
    otp: z.string().length(6, "OTP must be exactly 6 characters"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    phone: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian phone number"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    phone: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian phone number"),
    name: z.string().min(2, "Name must be at least 2 characters long"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});

export const setMpinSchema = z.object({
  body: z.object({
    mpin: z.string().length(6, "MPIN must be exactly 6 digits").regex(/^\d+$/, "MPIN must only contain digits"),
  }),
});

export const verifyMpinSchema = z.object({
  body: z.object({
    mpin: z.string().length(6, "MPIN must be exactly 6 digits").regex(/^\d+$/, "MPIN must only contain digits"),
  }),
});

export const setRoleSchema = z.object({
  body: z.object({
    role: z.literal("MEMBER", { required_error: "Role is required" }),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(8, "Current password must be at least 8 characters"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  }),
});
