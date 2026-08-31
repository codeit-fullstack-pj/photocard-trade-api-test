import { getDb, handle, json, err, requireAuth } from "@/lib/api";
import { notiJson } from "@/lib/store";

export const PATCH = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { notificationId } = await ctx.params;
  const n = db.notifications.find((x) => x.id === Number(notificationId));
  if (!n || n.userId !== user.id || n.deletedAt) err(404, "NOT_FOUND", "알림을 찾을 수 없습니다.");
  if (!n.isRead) {
    n.isRead = true;
    user.unreadCount = Math.max(0, user.unreadCount - 1);
  }
  return json(notiJson(n));
});
