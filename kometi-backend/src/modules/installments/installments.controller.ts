// src/modules/installments/installments.controller.ts
import { Response, NextFunction } from "express";
import { InstallmentsService } from "./installments.service";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export class InstallmentsController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { committeeId, status, page = 1, limit = 20 } = req.query;
      const result = await InstallmentsService.listInstallments(userId, {
        committeeId: committeeId as string,
        status: status as string,
        page: Number(page),
        limit: Number(limit),
      });
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  }

  static async upcoming(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const dues = await InstallmentsService.getUpcomingDues(userId);
      res.status(200).json({ success: true, data: dues });
    } catch (err) {
      next(err);
    }
  }

  static async dueToday(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const dues = await InstallmentsService.getDueToday(userId);
      res.status(200).json({ success: true, data: dues });
    } catch (err) {
      next(err);
    }
  }

  static async overdue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const dues = await InstallmentsService.getOverdue(userId);
      res.status(200).json({ success: true, data: dues });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const installment = await InstallmentsService.getById(id);
      res.status(200).json({ success: true, data: installment });
    } catch (err) {
      next(err);
    }
  }

  static async collect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const collectedById = req.user?.id;
      if (!collectedById) throw new Error("Unauthorized");

      const { id } = req.params;
      const { paymentMethod, paymentReference, notes } = req.body;

      await InstallmentsService.collectPayment(
        id,
        collectedById,
        paymentMethod,
        paymentReference,
        notes
      );

      res.status(200).json({ success: true, message: "Installment payment collected and processed successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async waive(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { id } = req.params;
      const { reason } = req.body;

      await InstallmentsService.waiveInstallment(id, userId, reason);
      res.status(200).json({ success: true, message: "Installment waived successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async bulkCollect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const collectedById = req.user?.id;
      if (!collectedById) throw new Error("Unauthorized");

      const { installments } = req.body;
      const results = await InstallmentsService.bulkCollect(installments, collectedById);
      res.status(200).json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  }
}
