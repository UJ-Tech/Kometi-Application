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
}
