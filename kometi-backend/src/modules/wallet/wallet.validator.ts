// src/modules/wallet/wallet.validator.ts
import { z } from "zod";

export const topupWalletSchema = z.object({
  body: z.object({
    amountPaise: z.union([z.string(), z.number()]).transform((val) => {
      const num = typeof val === "string" ? Number(val) : val;
      if (num <= 0) throw new Error("Amount must be greater than zero");
      return BigInt(Math.round(num));
    }),
    paymentMethod: z.string().optional(),
  }),
});

export const transferWalletSchema = z.object({
  body: z.object({
    recipientPhone: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian phone number"),
    amountPaise: z.union([z.string(), z.number()]).transform((val) => {
      const num = typeof val === "string" ? Number(val) : val;
      if (num <= 0) throw new Error("Amount must be greater than zero");
      return BigInt(Math.round(num));
    }),
  }),
});
