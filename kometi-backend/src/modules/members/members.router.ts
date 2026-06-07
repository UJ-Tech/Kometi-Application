// src/modules/members/members.router.ts
import { Router } from "express";
import { MembersController } from "./members.controller";
import { protect, authorize } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { updateKycSchema, verifyKycStatusSchema } from "./members.validator";

const router = Router();

// Protected member routes
router.use(protect as any);

router.get("/", MembersController.list as any);
router.get("/:id", MembersController.getById as any);
router.post("/kyc", validate(updateKycSchema), MembersController.updateKyc as any);

// Admins/Organizers only KYC approval
router.put(
  "/:id/kyc/status",
  authorize("ADMIN", "ORGANIZER") as any,
  validate(verifyKycStatusSchema),
  MembersController.verifyKyc as any
);

export default router;
