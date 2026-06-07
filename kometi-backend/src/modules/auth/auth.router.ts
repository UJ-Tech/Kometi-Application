// src/modules/auth/auth.router.ts
import { Router } from "express";
import { AuthController } from "./auth.controller";
import { validate } from "../../middleware/validate";
import { protect } from "../../middleware/auth.middleware";
import {
  sendOtpSchema,
  verifyOtpSchema,
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  setMpinSchema,
  verifyMpinSchema,
  setRoleSchema,
  changePasswordSchema,
} from "./auth.validator";

const router = Router();

router.post("/send-otp", validate(sendOtpSchema), AuthController.sendOtp);
router.post("/verify-otp", validate(verifyOtpSchema), AuthController.verifyOtp);
router.post("/login", validate(loginSchema), AuthController.login);
router.post("/register", validate(registerSchema), AuthController.register);
router.post("/refresh", validate(refreshTokenSchema), AuthController.refresh);
router.post("/logout", AuthController.logout);

// Protected routes
router.post("/set-mpin", protect as any, validate(setMpinSchema), AuthController.setMpin as any);
router.post("/verify-mpin", protect as any, validate(verifyMpinSchema), AuthController.verifyMpin as any);
router.get("/me", protect as any, AuthController.me as any);
router.put("/set-role", protect as any, validate(setRoleSchema), AuthController.setRole as any);
router.put("/change-password", protect as any, validate(changePasswordSchema), AuthController.changePassword as any);

export default router;
