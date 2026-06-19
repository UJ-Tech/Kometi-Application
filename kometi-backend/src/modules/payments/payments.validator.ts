// src/modules/payments/payments.validator.ts
import { z } from "zod";

export const addPaymentMethodSchema = z.object({
  body: z.object({
    methodType: z.enum(["upi", "bank_account", "card"]),
    upiId: z.string().min(3, "UPI ID is required").optional(),
    bankAccountNumber: z.string().min(8, "Bank account number is required").optional(),
    ifscCode: z.string().length(11, "IFSC code must be 11 characters").optional(),
    accountHolderName: z.string().min(2, "Account holder name is required").optional(),
  }),
});

export type AddPaymentMethodInput = z.infer<typeof addPaymentMethodSchema>;

export const createContributionOrderSchema = z.object({
  body: z.object({
    committeeId: z.string().min(1, "Committee ID is required"),
    monthId: z.string().min(1, "Month ID is required"),
    memberId: z.string().min(1, "Member ID is required"),
  }),
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    orderId: z.string().min(1, "Order ID is required"),
    paymentId: z.string().min(1, "Payment ID is required"),
    signature: z.string().min(1, "Signature is required"),
  }),
});

export const createWalletTopupOrderSchema = z.object({
  body: z.object({
    amountPaise: z.union([z.string(), z.number()]).transform((val) => {
      const num = typeof val === "string" ? Number(val) : val;
      if (num <= 0) throw new Error("Amount must be greater than zero");
      return num;
    }),
  }),
});

export const verifyWalletTopupSchema = z.object({
  body: z.object({
    orderId: z.string().min(1, "Order ID is required"),
    paymentId: z.string().min(1, "Payment ID is required"),
    signature: z.string().min(1, "Signature is required"),
  }),
});

export const payFromWalletSchema = z.object({
  body: z.object({
    committeeId: z.string().min(1, "Committee ID is required"),
    monthId: z.string().min(1, "Month ID is required"),
    memberId: z.string().min(1, "Member ID is required"),
  }),
});
