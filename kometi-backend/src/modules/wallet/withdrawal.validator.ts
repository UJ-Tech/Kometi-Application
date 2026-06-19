// src/modules/wallet/withdrawal.validator.ts
// Zod schemas for withdrawal request validation.

import { z } from "zod";

export const requestWithdrawalSchema = z.object({
  body: z.object({
    committeeId: z.string().min(1, "committeeId is required"),
    amount: z
      .union([z.string(), z.number()])
      .transform((val) => {
        const num = typeof val === "string" ? Number(val) : val;
        if (isNaN(num) || num <= 0) throw new Error("Amount must be a positive number");
        return Math.round(num);
      })
      .refine((val) => val >= 10000, "Minimum withdrawal is ₹100 (10000 paise)"),
    paymentMethodId: z.string().min(1, "paymentMethodId is required"),
  }),
});

export const getWithdrawalsSchema = z.object({
  query: z.object({
    committeeId: z.string().optional(),
    status: z
      .enum(["requested", "processing", "completed", "failed", "cancelled"])
      .optional(),
    limit: z
      .union([z.string(), z.number()])
      .transform((val) => {
        const num = typeof val === "string" ? Number(val) : val;
        return Math.min(Math.max(num || 20, 1), 100);
      })
      .optional(),
    offset: z
      .union([z.string(), z.number()])
      .transform((val) => {
        const num = typeof val === "string" ? Number(val) : val;
        return Math.max(num || 0, 0);
      })
      .optional(),
  }),
});

export const getWithdrawalByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Withdrawal ID is required"),
  }),
});

export const cancelWithdrawalSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Withdrawal ID is required"),
  }),
});
