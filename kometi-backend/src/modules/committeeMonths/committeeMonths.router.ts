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

export default router;
