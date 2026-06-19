// src/modules/wallet/withdrawal.controller.ts
// Express controller for withdrawal routes.

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { WithdrawalService } from "./withdrawal.service";

export class WithdrawalController {
  /**
   * POST /api/v1/wallet/withdraw
   * Request a withdrawal from wallet to bank/UPI.
   */
  static async request(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const memberId = req.user?.id;
      if (!memberId) throw new Error("Unauthorized");

      const { committeeId, amount, paymentMethodId } = req.body;

      const withdrawal = await WithdrawalService.requestWithdrawal({
        memberId,
        committeeId,
        amountPaise: Number(amount),
        paymentMethodId,
      });

      res.status(201).json({
        success: true,
        data: withdrawal,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/wallet/withdrawals
   * List withdrawal history for the authenticated member.
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const memberId = req.user?.id;
      if (!memberId) throw new Error("Unauthorized");

      const { committeeId, status, limit, offset } = req.query;

      const result = await WithdrawalService.listWithdrawals(memberId, {
        committeeId: committeeId as string | undefined,
        status: status as string | undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result.withdrawals,
        meta: {
          total: result.total,
          limit: limit ? Number(limit) : 20,
          offset: offset ? Number(offset) : 0,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/wallet/withdrawals/:id
   * Get a single withdrawal by ID.
   */
  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const memberId = req.user?.id;
      if (!memberId) throw new Error("Unauthorized");

      const { id } = req.params;

      const withdrawal = await WithdrawalService.getWithdrawal(id, memberId);

      res.status(200).json({
        success: true,
        data: withdrawal,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/wallet/withdrawals/:id/cancel
   * Cancel a pending withdrawal (only if status='requested').
   */
  static async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const memberId = req.user?.id;
      if (!memberId) throw new Error("Unauthorized");

      const { id } = req.params;

      const withdrawal = await WithdrawalService.cancelWithdrawal(id, memberId);

      res.status(200).json({
        success: true,
        data: withdrawal,
      });
    } catch (err) {
      next(err);
    }
  }
}
