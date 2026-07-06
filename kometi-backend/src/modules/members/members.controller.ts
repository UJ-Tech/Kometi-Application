// src/modules/members/members.controller.ts
import { Response, NextFunction } from "express";
import { MembersService } from "./members.service";
import { registerDeviceToken } from "../../config/push";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export class MembersController {
  static async list(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const members = await MembersService.listMembers();
      res.status(200).json({ success: true, data: members });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const member = await MembersService.getMemberById(id);
      res.status(200).json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  }

  static async updateKyc(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { aadhaarNum, panNum } = req.body;
      const kyc = await MembersService.updateKyc(userId, aadhaarNum, panNum);
      res.status(200).json({ success: true, data: kyc });
    } catch (err) {
      next(err);
    }
  }

  static async verifyKyc(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, rejectedReason } = req.body;
      await MembersService.updateKycStatus(id, status, rejectedReason);
      res.status(200).json({ success: true, data: { userId: id, status } });
    } catch (err) {
      next(err);
    }
  }

  static async registerDeviceToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { token } = req.body;
      if (!token || typeof token !== "string") {
        res.status(400).json({ success: false, message: "Token is required" });
        return;
      }

      const result = await registerDeviceToken(userId, token);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
