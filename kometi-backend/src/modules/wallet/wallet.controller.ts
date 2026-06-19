// src/modules/wallet/wallet.controller.ts
import { Response, NextFunction } from "express";
import { WalletService } from "./wallet.service";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export class WalletController {
  static async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const wallet = await WalletService.getWalletData(userId);
      const { transactions, ...walletData } = wallet;
      res.status(200).json({ success: true, data: walletData });
    } catch (err) {
      next(err);
    }
  }

  static async balance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const wallet = await WalletService.getWalletData(userId);
      res.status(200).json({
        success: true,
        data: {
          balancePaise: wallet.balancePaise,
          reservedPaise: wallet.reservedPaise || 0,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async transactions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const wallet = await WalletService.getWalletData(userId);
      res.status(200).json({
        success: true,
        data: wallet.transactions,
        meta: {
          total: wallet.transactions.length,
          page: 1,
          limit: wallet.transactions.length,
          hasMore: false,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async topup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { amountPaise } = req.body;
      await WalletService.topup(userId, amountPaise);

      res.status(200).json({ success: true, message: "Wallet topped up successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async transfer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const senderId = req.user?.id;
      if (!senderId) throw new Error("Unauthorized");

      const { recipientPhone, amountPaise } = req.body;
      await WalletService.transfer(senderId, recipientPhone, amountPaise);

      res.status(200).json({ success: true, message: "Wallet transfer completed successfully" });
    } catch (err) {
      next(err);
    }
  }
}
