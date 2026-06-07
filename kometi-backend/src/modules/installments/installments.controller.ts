// src/modules/installments/installments.controller.ts
import { Response, NextFunction } from "express";
import { InstallmentsService } from "./installments.service";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export class InstallmentsController {
  static async upcoming(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const dues = await InstallmentsService.getUpcomingDues(userId);
      res.status(200).json({ success: true, upcomingDues: dues });
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
}
