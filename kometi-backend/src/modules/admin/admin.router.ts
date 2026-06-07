// src/modules/admin/admin.router.ts
import { Router } from "express";
import { AdminController } from "./admin.controller";
import { protect, authorize } from "../../middleware/auth.middleware";

const router = Router();

// Protected admin routes
router.use(protect as any);

router.get(
  "/dashboard-stats",
  authorize("ADMIN", "MANAGER", "ACCOUNTANT", "AGENT") as any,
  AdminController.getDashboardStats as any
);

router.put(
  "/users/:id/role",
  authorize("ADMIN") as any,
  AdminController.updateUserRole as any
);

export default router;
