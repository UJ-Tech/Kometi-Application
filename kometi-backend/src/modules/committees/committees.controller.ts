// src/modules/committees/committees.controller.ts
import { Response, NextFunction } from "express";
import { CommitteesService } from "./committees.service";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export class CommitteesController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizerId = req.user?.id;
      if (!organizerId) throw new Error("Unauthorized");

      const { name, description, type, totalSlots, installmentAmountPaise, cycleDurationDays, includeOrganizerAsMember } = req.body;
      const committee = await CommitteesService.createCommittee(
        organizerId,
        name,
        description,
        type,
        totalSlots,
        installmentAmountPaise,
        cycleDurationDays,
        undefined,
        undefined,
        includeOrganizerAsMember
      );

      res.status(201).json({ success: true, data: committee });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");
      const committees = await CommitteesService.listCommittees(userId);
      res.status(200).json({ success: true, data: committees });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");
      const committee = await CommitteesService.getCommitteeById(id, userId);
      res.status(200).json({ success: true, data: committee });
    } catch (err) {
      next(err);
    }
  }

  static async addMember(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { userId, slotNumber } = req.body;
      const member = await CommitteesService.addMemberToCommittee(id, userId, slotNumber);
      res.status(200).json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  }

  static async start(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await CommitteesService.startCommittee(id);
      res.status(200).json({ success: true, message: "Committee started and schedules generated successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async submitBid(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { amountPaise } = req.body;
      const bid = await CommitteesService.submitBid(id, userId, Number(amountPaise));
      res.status(201).json({ success: true, data: bid });
    } catch (err) {
      next(err);
    }
  }

  static async resolveAuction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { cycleNo } = req.body;
      const result = await CommitteesService.resolveAuction(id, Number(cycleNo));
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async joinByCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { inviteCode } = req.body;
      const result = await CommitteesService.joinByCode(userId, inviteCode);
      res.status(200).json({
        success: true,
        data: {
          committee: { id: result.committee.id, name: result.committee.name },
          joinRequest: result.joinRequest,
          isRetry: result.isRetry,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getJoinRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { id } = req.params;
      const requests = await CommitteesService.getJoinRequests(id, userId);
      res.status(200).json({ success: true, data: requests });
    } catch (err) {
      next(err);
    }
  }

  static async approveJoinRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { id, requestId } = req.params;
      const result = await CommitteesService.approveJoinRequest(id, requestId, userId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async rejectJoinRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { id, requestId } = req.params;
      const result = await CommitteesService.rejectJoinRequest(id, requestId, userId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getMyJoinRequestStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { id } = req.params;
      const request = await CommitteesService.getMyJoinRequestStatus(id, userId);
      res.status(200).json({ success: true, data: request });
    } catch (err) {
      next(err);
    }
  }

  static async getSchedule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { id } = req.params;
      const schedule = await CommitteesService.getCommitteeSchedule(id, userId);
      res.status(200).json({ success: true, data: schedule });
    } catch (err) {
      next(err);
    }
  }

  // ─── LOTTERY (FIXED_WINNER) FLOW ──────────────────────────────────────

  static async getLotteryStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { id } = req.params;
      const status = await CommitteesService.getLotteryStatus(id, userId);
      res.status(200).json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  }

  static async lockLotteryMembers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { id } = req.params;
      const result = await CommitteesService.lockLotteryMembers(id, userId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async drawLotteryWinner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { id } = req.params;
      const result = await CommitteesService.drawLotteryWinner(id, userId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async confirmLotteryPayout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { id } = req.params;
      const result = await CommitteesService.confirmLotteryPayout(id, userId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getLotteryReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { id, cycleNo } = req.params;
      const receipt = await CommitteesService.getLotteryReceipt(id, Number(cycleNo), userId);
      res.status(200).json({ success: true, data: receipt });
    } catch (err) {
      next(err);
    }
  }
}
