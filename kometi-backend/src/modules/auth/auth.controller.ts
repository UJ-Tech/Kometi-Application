// src/modules/auth/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import supabase from "../../config/supabase";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";

export class AuthController {
  static async sendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone } = req.body;
      const otp = await AuthService.sendOtp(phone);
      res.status(200).json({ success: true, message: "OTP sent successfully", mockOtp: otp });
    } catch (err) {
      next(err);
    }
  }

  static async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, otp } = req.body;
      const result = await AuthService.verifyOtp(phone, otp);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, phone, password } = req.body;
      const result = await AuthService.login(email, phone, password);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, name, email, password } = req.body;
      const result = await AuthService.registerUser(phone, name, email, password);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const result = await AuthService.refreshAccessToken(refreshToken);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      await AuthService.logout(refreshToken);
      res.status(200).json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  }

  static async setMpin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { mpin } = req.body;
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");
      
      await AuthService.setMpin(userId, mpin);
      res.status(200).json({ success: true, data: null, message: "MPIN updated successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async verifyMpin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { mpin } = req.body;
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const isValid = await AuthService.verifyMpin(userId, mpin);
      if (!isValid) {
        res.status(400).json({ success: false, error: "Invalid MPIN" });
        return;
      }

      res.status(200).json({ success: true, data: { verified: true }, message: "MPIN verified successfully" });
    } catch (err) {
      next(err);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { data: user, error } = await supabase
        .from("users")
        .select("*, wallets(*)")
        .eq("id", userId)
        .single();

      if (error) throw error;

      res.status(200).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }

  static async setRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { role } = req.body;
      const user = await AuthService.setUserRole(userId, role);
      res.status(200).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("Unauthorized");

      const { currentPassword, newPassword } = req.body;
      await AuthService.changePassword(userId, currentPassword, newPassword);
      res.status(200).json({ success: true, data: null, message: "Password changed successfully" });
    } catch (err) {
      next(err);
    }
  }
}
