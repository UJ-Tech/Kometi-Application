// src/modules/wallet/wallet.validator.ts
import { z } from "zod";

export const topupWalletSchema = z.object({
  body: z.object({
    amountPaise: z.string().transform((val) => BigInt(val)),
  }),
});

export const transferWalletSchema = z.object({
  body: z.object({
    recipientPhone: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian phone number"),
    amountPaise: z.string().transform((val) => BigInt(val)),
  }),
});
