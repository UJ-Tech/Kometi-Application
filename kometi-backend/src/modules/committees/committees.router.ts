// src/modules/committees/committees.router.ts
import { Router } from "express";
import { CommitteesController } from "./committees.controller";
import { protect, authorizeOrganizer } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { createCommitteeSchema, addMemberSchema, joinByCodeSchema, adjustCommitteeSizeSchema } from "./committees.validator";

import committeeMonthsRouter from "../committeeMonths/committeeMonths.router";

const router = Router();

// Protected committee routes
router.use(protect as any);

router.use("/:id/months", committeeMonthsRouter);

router.get("/", CommitteesController.list as any);
router.get("/:id", CommitteesController.getById as any);

// Any authenticated user can create a committee (they become the organizer)
router.post(
  "/",
  validate(createCommitteeSchema),
  CommitteesController.create as any
);

// Committee management — only the organizer of that specific committee (or admin)
router.post(
  "/:id/members",
  authorizeOrganizer() as any,
  validate(addMemberSchema),
  CommitteesController.addMember as any
);

router.post(
  "/:id/adjust-size",
  authorizeOrganizer() as any,
  validate(adjustCommitteeSizeSchema),
  CommitteesController.adjustCommitteeSize as any
);

router.post(
  "/:id/start",
  authorizeOrganizer() as any,
  CommitteesController.start as any
);

router.post(
  "/:id/bid",
  CommitteesController.submitBid as any
);

// Join by invite code (any authenticated user)
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

// Join request management (committee organizer only)
router.get(
  "/:id/join-requests",
  authorizeOrganizer() as any,
  CommitteesController.getJoinRequests as any
);

router.post(
  "/:id/join-requests/:requestId/approve",
  authorizeOrganizer() as any,
  CommitteesController.approveJoinRequest as any
);

router.post(
  "/:id/join-requests/:requestId/reject",
  authorizeOrganizer() as any,
  CommitteesController.rejectJoinRequest as any
);

router.get(
  "/:id/schedule",
  CommitteesController.getSchedule as any
);

// ─── LOTTERY (FIXED_WINNER) ROUTES ────────────────────────────────────

router.get(
  "/:id/lottery/status",
  authorizeOrganizer() as any,
  CommitteesController.getLotteryStatus as any
);

router.post(
  "/:id/lottery/lock",
  authorizeOrganizer() as any,
  CommitteesController.lockLotteryMembers as any
);

router.post(
  "/:id/lottery/draw",
  authorizeOrganizer() as any,
  CommitteesController.drawLotteryWinner as any
);

router.post(
  "/:id/lottery/confirm",
  authorizeOrganizer() as any,
  CommitteesController.confirmLotteryPayout as any
);

router.get(
  "/:id/lottery/receipt/:cycleNo",
  CommitteesController.getLotteryReceipt as any
);

router.get(
  "/:id/members/:memberId/stats",
  CommitteesController.getMemberStats as any
);

// ─── BLOCK/UNBLOCK ROUTES ──────────────────────────────────────────────

router.post(
  "/:id/members/:memberId/block",
  authorizeOrganizer() as any,
  CommitteesController.blockMember as any
);

router.post(
  "/:id/members/:memberId/unblock",
  authorizeOrganizer() as any,
  CommitteesController.unblockMember as any
);

router.get(
  "/:id/blocked-members",
  authorizeOrganizer() as any,
  CommitteesController.getBlockedMembers as any
);

// ─── REMOVE / RE-ADD MEMBER ────────────────────────────────────────────

router.delete(
  "/:id/members/:memberId",
  authorizeOrganizer() as any,
  CommitteesController.removeMember as any
);

router.post(
  "/:id/members/add-active",
  authorizeOrganizer() as any,
  CommitteesController.addMemberToActive as any
);

export default router;
