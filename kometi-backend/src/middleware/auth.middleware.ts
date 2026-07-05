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
    isActive: boolean;
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
        .select("id, phone, isActive")
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

/**
 * Authorize if user is ADMIN or the organizer of the committee identified by :id param.
 * Committee management is based on ownership, not a global user role.
 */
export function authorizeOrganizer() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Not authorized" });
      return;
    }

    const committeeId = req.params.id;
    if (!committeeId) {
      res.status(400).json({ error: "Committee ID is required" });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("committees")
        .select("organizerId")
        .eq("id", committeeId)
        .single();

      if (error || !data) {
        res.status(404).json({ error: "Committee not found" });
        return;
      }
      if (data.organizerId !== req.user.id) {
        res.status(403).json({
          error: "Only the committee organizer can perform this action",
        });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "Failed to verify committee ownership" });
    }
  };
}
