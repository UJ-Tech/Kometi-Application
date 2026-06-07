// src/modules/installments/installments.validator.ts
import { z } from "zod";

export const collectPaymentSchema = z.object({
  body: z.object({
    paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "WALLET"]),
    paymentReference: z.string().optional(),
    notes: z.string().optional(),
  }),
});
