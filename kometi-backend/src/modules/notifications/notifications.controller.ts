// src/modules/notifications/notifications.controller.ts
import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import supabase from "../../config/supabase";

export class NotificationsController {

  // GET /api/v1/notifications
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("userId", userId)
        .order("createdAt", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: data || [],
        meta: {
          total: count || 0,
          page,
          limit,
          hasMore: (count || 0) > offset + limit,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/v1/notifications/unread-count
  static async unreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("userId", userId)
        .eq("isRead", false);

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: { count: count || 0 },
      });
    } catch (err) {
      next(err);
    }
  }

  // PUT /api/v1/notifications/:id/read
  static async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { error } = await supabase
        .from("notifications")
        .update({ isRead: true })
        .eq("id", id)
        .eq("userId", userId);

      if (error) throw error;

      res.status(200).json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  }

  // PUT /api/v1/notifications/read-all
  static async markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { error } = await supabase
        .from("notifications")
        .update({ isRead: true })
        .eq("userId", userId)
        .eq("isRead", false);

      if (error) throw error;

      res.status(200).json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  }
}
