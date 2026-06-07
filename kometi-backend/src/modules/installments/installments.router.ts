// src/modules/installments/installments.router.ts
import { Router } from "express";
import { InstallmentsController } from "./installments.controller";
import { protect } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { collectPaymentSchema } from "./installments.validator";

const router = Router();

// Protected installment routes
router.use(protect as any);

router.get("/upcoming", InstallmentsController.upcoming as any);
router.post("/:id/pay", validate(collectPaymentSchema), InstallmentsController.collect as any);

export default router;
