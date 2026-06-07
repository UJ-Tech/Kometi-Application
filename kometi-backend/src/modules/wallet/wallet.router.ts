// src/modules/wallet/wallet.router.ts
import { Router } from "express";
import { WalletController } from "./wallet.controller";
import { protect } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { topupWalletSchema, transferWalletSchema } from "./wallet.validator";

const router = Router();

// Protected wallet routes
router.use(protect as any);

router.get("/", WalletController.get as any);
router.get("/balance", WalletController.balance as any);
router.get("/transactions", WalletController.transactions as any);
router.post("/topup", validate(topupWalletSchema), WalletController.topup as any);
router.post("/transfer", validate(transferWalletSchema), WalletController.transfer as any);

export default router;
