// src/modules/committees/committees.validator.ts
import { z } from "zod";

export const createCommitteeSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    description: z.string().optional(),
    type: z.enum(["FIXED_WINNER", "AUCTION", "FIXED_ORDER"]),
    totalSlots: z.number().int().min(2).max(50),
    installmentAmountPaise: z.union([z.string(), z.number()]).transform((val) => BigInt(val)),
    cycleDurationDays: z.number().int().min(1),
    commissionRatePct: z.number().min(0).max(100).optional(),
    maxDiscountPct: z.number().min(0).max(100).optional(),
    includeOrganizerAsMember: z.boolean().optional(),
  }),
});

export const addMemberSchema = z.object({
  body: z.object({
    userId: z.string().cuid("Invalid User ID format"),
    slotNumber: z.number().int().min(1),
  }),
});

export const joinByCodeSchema = z.object({
  body: z.object({
    inviteCode: z.string().min(8, "Invite code must be 8 characters").max(8, "Invite code must be 8 characters"),
  }),
});
