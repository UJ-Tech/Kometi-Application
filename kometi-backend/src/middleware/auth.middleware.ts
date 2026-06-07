// src/middleware/auth.middleware.ts
// Express JWT authorization middleware.

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import env from "../config/env";
import supabase from "../config/supabase";
import { AuthService } from "../modules/auth/auth.service";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    phone: string;
    role: "ADMIN" | "MANAGER" | "ACCOUNTANT" | "AGENT" | "ORGANIZER" | "MEMBER";
  };
}

export async function protect(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    res.status(401).json({ error: "Not authorized to access this route" });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };

    let user;
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, phone, role, isActive")
        .eq("id", decoded.id)
        .single();
      
      if (error) throw error;
      user = data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isDbDown = 
        message.includes("fetch failed") || 
        message.includes("TypeError: failed to fetch") || 
        message.includes("20P01");

      if (!isDbDown) {
        throw error;
      }
      user = await AuthService.getUserForAuth(decoded.id);
    }

    if (!user || !user.isActive) {
      res.status(401).json({ error: "User no longer exists or is disabled" });
      return;
    }

    req.user = user;
    next();
    return;
  } catch (err) {
    res.status(401).json({ error: "Not authorized to access this route" });
    return;
  }
}

export function authorize(...roles: Array<"ADMIN" | "MANAGER" | "ACCOUNTANT" | "AGENT" | "ORGANIZER" | "MEMBER">) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role as any)) {
      res.status(403).json({
        error: `User role '${req.user?.role}' is not authorized to access this action`,
      });
      return;
    }
    next();
    return;
  };
}
