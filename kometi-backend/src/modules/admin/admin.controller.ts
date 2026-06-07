// src/modules/admin/admin.controller.ts
import { Response, NextFunction } from "express";
import { AdminService } from "./admin.service";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export class AdminController {
  static async getDashboardStats(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const stats = await AdminService.getDashboardStats();
      res.status(200).json({ success: true, stats });
    } catch (err) {
      next(err);
    }
  }

  static async updateUserRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!role) {
        res.status(400).json({ success: false, error: "Role is required" });
        return;
      }

      // Prevent updating self to a non-admin role
      if (req.user?.id === id && role !== "ADMIN") {
        res.status(400).json({ success: false, error: "Admins cannot change their own role to a non-admin role" });
        return;
      }

      const user = await AdminService.updateUserRole(id, role);
      res.status(200).json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }
}
