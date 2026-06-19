// src/modules/wallet/withdrawal.router.ts
// Express router for wallet withdrawal routes.
// Mounted at /api/v1/wallet/withdrawals

import { Router } from "express";
import { WithdrawalController } from "./withdrawal.controller";
import { protect } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { requestWithdrawalSchema, cancelWithdrawalSchema } from "./withdrawal.validator";

const router = Router();

// All withdrawal routes require authentication
router.use(protect as any);

// POST / — Request a withdrawal
router.post(
  "/",
  validate(requestWithdrawalSchema),
  WithdrawalController.request as any
);

// GET / — List withdrawal history
router.get("/", WithdrawalController.list as any);

// GET /:id — Get withdrawal details
router.get("/:id", WithdrawalController.getById as any);

// POST /:id/cancel — Cancel a pending withdrawal
router.post(
  "/:id/cancel",
  validate(cancelWithdrawalSchema),
  WithdrawalController.cancel as any
);

export default router;
