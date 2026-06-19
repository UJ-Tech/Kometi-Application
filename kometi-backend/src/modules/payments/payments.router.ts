// src/modules/payments/payments.router.ts
import { Router } from "express";
import { PaymentsController } from "./payments.controller";
import { protect } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import {
  addPaymentMethodSchema,
  createContributionOrderSchema,
  verifyPaymentSchema,
  createWalletTopupOrderSchema,
  verifyWalletTopupSchema,
  payFromWalletSchema,
} from "./payments.validator";

const router = Router();

// All payment routes require authentication
router.use(protect as any);

// ─── Saved Payment Methods ─────────────────────────────────────────────
router.get("/methods", PaymentsController.listMethods as any);
router.get("/methods/:methodId", PaymentsController.getMethod as any);
router.post("/methods", validate(addPaymentMethodSchema), PaymentsController.addMethod as any);
router.put("/methods/:methodId/default", PaymentsController.setDefault as any);
router.delete("/methods/:methodId", PaymentsController.deleteMethod as any);

// ─── Wallet Top-Up via Razorpay ────────────────────────────────────────
router.post(
  "/wallet-topup/order",
  validate(createWalletTopupOrderSchema),
  PaymentsController.createWalletTopupOrder as any
);
router.post(
  "/wallet-topup/verify",
  validate(verifyWalletTopupSchema),
  PaymentsController.verifyWalletTopup as any
);

// ─── Contribution Payment Flow ─────────────────────────────────────────
router.post(
  "/contribution-order",
  validate(createContributionOrderSchema),
  PaymentsController.createContributionOrder as any
);
router.post(
  "/verify-payment",
  validate(verifyPaymentSchema),
  PaymentsController.verifyAndCapturePayment as any
);

// ─── Pay Contribution from Wallet ─────────────────────────────────────
router.post(
  "/pay-from-wallet",
  validate(payFromWalletSchema),
  PaymentsController.payFromWallet as any
);

export default router;
