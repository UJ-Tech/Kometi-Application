// src/modules/admin/admin.router.ts
import { Router } from "express";
import { AdminController } from "./admin.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

// Protected admin routes
router.use(protect as any);

router.get(
  "/dashboard-stats",
  AdminController.getDashboardStats as any
);

export default router;
