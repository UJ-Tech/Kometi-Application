// src/modules/committees/committees.router.ts
import { Router } from "express";
import { CommitteesController } from "./committees.controller";
import { protect, authorize } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { createCommitteeSchema, addMemberSchema, joinByCodeSchema, adjustCommitteeSizeSchema } from "./committees.validator";

import committeeMonthsRouter from "../committeeMonths/committeeMonths.router";

const router = Router();

// Protected committee routes
router.use(protect as any);

router.use("/:id/months", committeeMonthsRouter);

router.get("/", CommitteesController.list as any);
router.get("/:id", CommitteesController.getById as any);

// Organizers or Admins only allowed to manage committee lifecycle
router.post(
  "/",
  authorize("ADMIN", "ORGANIZER") as any,
  validate(createCommitteeSchema),
  CommitteesController.create as any
);

router.post(
  "/:id/members",
  authorize("ADMIN", "ORGANIZER") as any,
  validate(addMemberSchema),
  CommitteesController.addMember as any
);

router.post(
  "/:id/adjust-size",
  authorize("ADMIN", "ORGANIZER") as any,
  validate(adjustCommitteeSizeSchema),
  CommitteesController.adjustCommitteeSize as any
);

router.post(
  "/:id/start",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteesController.start as any
);

router.post(
  "/:id/bid",
  CommitteesController.submitBid as any
);

// Join by invite code (any authenticated member)
router.post(
  "/join-by-code",
  validate(joinByCodeSchema),
  CommitteesController.joinByCode as any
);

// Member's own join request status (any authenticated user)
router.get(
  "/:id/join-requests/my-status",
  CommitteesController.getMyJoinRequestStatus as any
);

// Join request management (organizer only)
router.get(
  "/:id/join-requests",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteesController.getJoinRequests as any
);

router.post(
  "/:id/join-requests/:requestId/approve",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteesController.approveJoinRequest as any
);

router.post(
  "/:id/join-requests/:requestId/reject",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteesController.rejectJoinRequest as any
);

router.get(
  "/:id/schedule",
  CommitteesController.getSchedule as any
);

// ─── LOTTERY (FIXED_WINNER) ROUTES ────────────────────────────────────

router.get(
  "/:id/lottery/status",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteesController.getLotteryStatus as any
);

router.post(
  "/:id/lottery/lock",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteesController.lockLotteryMembers as any
);

router.post(
  "/:id/lottery/draw",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteesController.drawLotteryWinner as any
);

router.post(
  "/:id/lottery/confirm",
  authorize("ADMIN", "ORGANIZER") as any,
  CommitteesController.confirmLotteryPayout as any
);

router.get(
  "/:id/lottery/receipt/:cycleNo",
  CommitteesController.getLotteryReceipt as any
);

export default router;
