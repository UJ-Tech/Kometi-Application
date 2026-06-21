// src/modules/committeeMonths/committeeMonths.router.ts
import { Router } from "express";
import { CommitteeMonthsController } from "./committeeMonths.controller";
import { protect, authorize } from "../../middleware/auth.middleware";

const router = Router({ mergeParams: true }); // mergeParams gives access to :id from parent router

// All routes require authentication
router.use(protect as any);

// GET /api/v1/committees/:id/months
// Returns all months with live projected calculations
router.get("/", CommitteeMonthsController.getMonths as any);

// GET /api/v1/committees/:id/months/project?monthNumber=3&winningBidAmount=50000
// Dynamically project calculations for any month number
router.get("/project", CommitteeMonthsController.projectMonth as any);

// GET /api/v1/committees/:id/months/late-fee?memberId=...&monthId=...&weeksLate=2
// Calculate late fee for a specific member contribution
router.get("/late-fee", CommitteeMonthsController.getLateFee as any);

// GET /api/v1/committees/:id/months/member/:memberId/earnings
// Total earnings summary for the last/patient member
router.get(
  "/member/:memberId/earnings",
  CommitteeMonthsController.getMemberEarnings as any
);

// GET /api/v1/committees/:id/months/overdue
// Get overdue payment obligations (organiser only)
router.get(
  "/overdue",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteeMonthsController.getOverdueObligations as any
);

// GET /api/v1/committees/:id/months/organiser-advances
// Get organiser's advance records (organiser only)
router.get(
  "/organiser-advances",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteeMonthsController.getOrganiserAdvances as any
);

// POST /api/v1/committees/:id/months
// Create a new committee month with pre-calculated values (organizer only)
router.post(
  "/",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteeMonthsController.createMonth as any
);

// POST /api/v1/committees/:id/months/:monthId/resolve
// Resolve a month: set winner, recalculate actuals, create disbursements (organizer only)
router.post(
  "/:monthId/resolve",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteeMonthsController.resolveMonth as any
);

// GET /api/v1/committees/:id/months/:monthId
// Get full details of a specific month (including bids and distributions)
router.get(
  "/:monthId",
  CommitteeMonthsController.getMonth as any
);

// POST /api/v1/committees/:id/months/:monthNumber/open-bidding
// Open bidding for a month (organizer only)
router.post(
  "/:monthNumber/open-bidding",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteeMonthsController.openBidding as any
);

// POST /api/v1/committees/:id/months/:monthId/bids
// Place a bid for a month
router.post(
  "/:monthId/bids",
  CommitteeMonthsController.placeBid as any
);

// GET /api/v1/committees/:id/months/:monthId/members/:memberId/eligibility
// Get eligibility status for a member to bid in a month
router.get(
  "/:monthId/members/:memberId/eligibility",
  CommitteeMonthsController.getEligibility as any
);

// POST /api/v1/committees/:id/months/:monthId/pay-net
// Non-winner pays their net obligation after resolution
router.post(
  "/:monthId/pay-net",
  CommitteeMonthsController.payNetAmount as any
);

// POST /api/v1/committees/:id/months/:monthId/organiser-advance
// Organiser advances payment for a defaulting member (organizer only)
router.post(
  "/:monthId/organiser-advance",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteeMonthsController.organiserAdvance as any
);

// GET /api/v1/committees/:id/months/:monthId/obligations
// Get payment obligations for a resolved month
router.get(
  "/:monthId/obligations",
  CommitteeMonthsController.getObligations as any
);

// POST /api/v1/committees/:id/months/:monthId/settle-payout
// Manually trigger winner payout settlement (organizer only)
router.post(
  "/:monthId/settle-payout",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteeMonthsController.settlePayout as any
);

export default router;
