// src/config/env.ts
// Zod validated environment configuration.

import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().transform((v) => parseInt(v, 10)).default("5000"),
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection string"),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid Supabase project URL"),
  SUPABASE_ANON_KEY: z.string().min(20, "SUPABASE_ANON_KEY is required"),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters long"),

  JWT_REFRESH_SECRET: z.string().min(8, "JWT_REFRESH_SECRET must be at least 8 characters long"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY is required for backend API"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().min(1, "RAZORPAY_KEY_ID is required"),
  RAZORPAY_KEY_SECRET: z.string().min(1, "RAZORPAY_KEY_SECRET is required"),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables configuration:");
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const env = parsedEnv.data!;
export default env;
