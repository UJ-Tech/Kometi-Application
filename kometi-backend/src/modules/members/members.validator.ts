// src/modules/members/members.validator.ts
import { z } from "zod";

export const updateKycSchema = z.object({
  body: z.object({
    aadhaarNum: z.string().regex(/^\d{12}$/, "Aadhaar must be exactly 12 digits").optional(),
    panNum: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN Format").optional(),
  }),
});

export const verifyKycStatusSchema = z.object({
  body: z.object({
    status: z.enum(["PENDING", "SUBMITTED", "VERIFIED", "REJECTED"]),
    rejectedReason: z.string().optional(),
  }),
});
