// src/modules/committeeMonths/committeeMonths.controller.ts
import { Response, NextFunction } from "express";
import { CommitteeMonthsService } from "./committeeMonths.service";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export class CommitteeMonthsController {

  // GET /api/v1/committees/:id/months
  // Returns all months for the committee with live projected calculations
  static async getMonths(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id || id === "undefined") {
        res.status(400).json({ success: false, message: "Invalid committee ID" });
        return;
      }
      const data = await CommitteeMonthsService.getMonthsForCommittee(id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/committees/:id/months/:monthId
  // Returns details for a single month including bids and distributions
  static async getMonth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, monthId } = req.params;
      if (!id || id === "undefined") {
        res.status(400).json({ success: false, message: "Invalid committee ID" });
        return;
      }
      if (!monthId || monthId === "undefined") {
        res.status(400).json({ success: false, message: "Invalid month ID" });
        return;
      }
      const data = await CommitteeMonthsService.getMonthDetail(id, monthId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/committees/:id/months/project?monthNumber=3&winningBidAmount=50000
  // Returns a dynamic projection for any month number (before it is created)
  static async projectMonth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const monthNumber = Number(req.query.monthNumber);
      const winningBidAmount = req.query.winningBidAmount
        ? Number(req.query.winningBidAmount)
        : undefined;

      if (!monthNumber || monthNumber < 1) {
        res.status(400).json({ success: false, message: "monthNumber query param is required and must be >= 1" });
        return;
      }

      const data = await CommitteeMonthsService.calculateProjectedMonth(
        id,
        monthNumber,
        winningBidAmount
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/committees/:id/months
  // Create a new committee month entry with pre-calculated values
  static async createMonth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { monthNumber, monthDate, resolutionType, winningBidAmount } = req.body;

      const data = await CommitteeMonthsService.createMonth({
        committeeId: id,
        monthNumber: Number(monthNumber),
        monthDate,
        resolutionType,
        winningBidAmount: winningBidAmount ? Number(winningBidAmount) : undefined,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/committees/:id/months/:monthNumber/open-bidding
  static async openBidding(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, monthNumber } = req.params;
      const data = await CommitteeMonthsService.openBiddingForMonth(id, Number(monthNumber));
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/committees/:id/months/:monthId/bids
  static async placeBid(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, monthId } = req.params;
      const { memberId, bidAmount } = req.body;
      const data = await CommitteeMonthsService.placeBid(id, monthId, memberId, Number(bidAmount));
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/committees/:id/months/:monthId/resolve
  // Resolve a month: automatically determines winner, recalculates actuals, creates disbursements and distributions
  static async resolveMonth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, monthId } = req.params;

      const data = await CommitteeMonthsService.resolveMonth(id, monthId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/committees/:id/months/:monthId/members/:memberId/eligibility
  static async getEligibility(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, monthId, memberId } = req.params;
      const data = await CommitteeMonthsService.getMemberEligibility(id, memberId, monthId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/committees/:id/months/late-fee?memberId=...&monthId=...&weeksLate=2
  // Calculate late fee for a specific member's contribution
  static async getLateFee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { memberId, monthId, weeksLate } = req.query;

      if (!memberId || !monthId || weeksLate === undefined) {
        res.status(400).json({ success: false, message: "memberId, monthId and weeksLate query params are required" });
        return;
      }

      const data = await CommitteeMonthsService.calculateMemberLateFee({
        committeeId: id,
        memberId: String(memberId),
        monthId: String(monthId),
        weeksLate: Number(weeksLate),
      });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/committees/:id/members/:memberId/earnings
  // Get total earnings for the last member of a committee
  static async getMemberEarnings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, memberId } = req.params;
      const data = await CommitteeMonthsService.getLastMemberEarnings(id, memberId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/committees/:id/months/:monthId/pay-net
  // Non-winner pays their net obligation after resolution
  static async payNetAmount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, monthId } = req.params;
      const { memberId } = req.body;
      const data = await CommitteeMonthsService.payNetAmount(id, monthId, memberId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/committees/:id/months/:monthId/organiser-advance
  // Organiser advances payment for a defaulting member
  static async organiserAdvance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, monthId } = req.params;
      const { memberId } = req.body;
      const organiserId = req.user?.id;
      if (!organiserId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const data = await CommitteeMonthsService.organiserAdvance(id, monthId, memberId, organiserId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/committees/:id/months/:monthId/obligations
  // Get payment obligations for a resolved month
  static async getObligations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, monthId } = req.params;
      const data = await CommitteeMonthsService.getObligations(id, monthId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/v1/committees/:id/months/:monthId/settle-payout
  static async settlePayout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id, monthId } = req.params;
      const result = await CommitteeMonthsService.settleWinnerPayoutIfNeeded(id, monthId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/committees/:id/months/overdue
  // Get overdue payment obligations (organiser only)
  static async getOverdueObligations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = await CommitteeMonthsService.getOverdueObligations(id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/committees/:id/months/organiser-advances
  // Get organiser's advance records (organiser only)
  static async getOrganiserAdvances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organiserId = req.user?.id;
      if (!organiserId) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }
      const data = await CommitteeMonthsService.getOrganiserAdvances(id, organiserId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}
