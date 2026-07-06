// src/modules/notifications/notifications.router.ts
import { Router } from "express";
import { NotificationsController } from "./notifications.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

router.use(protect as any);

router.get("/", NotificationsController.list as any);
router.get("/unread-count", NotificationsController.unreadCount as any);
router.put("/:id/read", NotificationsController.markRead as any);
router.put("/read-all", NotificationsController.markAllRead as any);

export default router;
