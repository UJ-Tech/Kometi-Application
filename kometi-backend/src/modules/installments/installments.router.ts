// src/modules/installments/installments.router.ts
import { Router } from "express";
import { InstallmentsController } from "./installments.controller";
import { protect } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { collectPaymentSchema } from "./installments.validator";

const router = Router();

// Protected installment routes
router.use(protect as any);

router.get("/", InstallmentsController.list as any);
router.get("/upcoming", InstallmentsController.upcoming as any);
router.get("/due-today", InstallmentsController.dueToday as any);
router.get("/overdue", InstallmentsController.overdue as any);
router.get("/:id", InstallmentsController.getById as any);
router.post("/:id/collect", validate(collectPaymentSchema), InstallmentsController.collect as any);
router.post("/:id/waive", InstallmentsController.waive as any);
router.post("/bulk-collect", InstallmentsController.bulkCollect as any);

export default router;
