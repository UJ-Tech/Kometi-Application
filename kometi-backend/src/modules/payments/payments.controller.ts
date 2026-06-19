// src/modules/payments/payments.controller.ts
import { Response, NextFunction } from "express";
import { PaymentsService } from "./payments.service";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export class PaymentsController {
  // ─── List saved payment methods ────────────────────────────────────────
  static async listMethods(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const methods = await PaymentsService.listMethods(userId);
      res.status(200).json({ success: true, data: methods });
    } catch (err) {
      next(err);
    }
  }

  // ─── Get single payment method ─────────────────────────────────────────
  static async getMethod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { methodId } = req.params;
      const method = await PaymentsService.getMethod(userId, methodId);
      res.status(200).json({ success: true, data: method });
    } catch (err) {
      next(err);
    }
  }

  // ─── Add new payment method ────────────────────────────────────────────
  static async addMethod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { methodType, upiId, bankAccountNumber, ifscCode, accountHolderName } = req.body;
      const method = await PaymentsService.addMethod(userId, {
        methodType,
        upiId,
        bankAccountNumber,
        ifscCode,
        accountHolderName,
      });

      res.status(201).json({ success: true, data: method });
    } catch (err) {
      next(err);
    }
  }

  // ─── Set default payment method ────────────────────────────────────────
  static async setDefault(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { methodId } = req.params;
      await PaymentsService.setDefault(userId, methodId);
      res.status(200).json({ success: true, message: "Default payment method updated" });
    } catch (err) {
      next(err);
    }
  }

  // ─── Delete payment method ─────────────────────────────────────────────
  static async deleteMethod(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { methodId } = req.params;
      await PaymentsService.deleteMethod(userId, methodId);
      res.status(200).json({ success: true, message: "Payment method deleted" });
    } catch (err) {
      next(err);
    }
  }

  // ─── Create contribution order ─────────────────────────────────────────
  static async createContributionOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { committeeId, monthId, memberId } = req.body;

      const order = await PaymentsService.createContributionOrder(committeeId, monthId, memberId);
      res.status(201).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  // ─── Verify and capture payment ────────────────────────────────────────
  static async verifyAndCapturePayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { orderId, paymentId, signature } = req.body;

      const result = await PaymentsService.verifyAndCapturePayment(orderId, paymentId, signature);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // ─── Create wallet top-up order ────────────────────────────────────────
  static async createWalletTopupOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { amountPaise } = req.body;
      const order = await PaymentsService.createWalletTopupOrder(userId, amountPaise);
      res.status(201).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  // ─── Verify wallet top-up payment ──────────────────────────────────────
  static async verifyWalletTopup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { orderId, paymentId, signature } = req.body;
      const result = await PaymentsService.verifyWalletTopupPayment(userId, orderId, paymentId, signature);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // ─── Pay contribution from wallet ──────────────────────────────────────
  static async payFromWallet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { committeeId, monthId, memberId } = req.body;
      const result = await PaymentsService.payFromWallet(committeeId, monthId, memberId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
