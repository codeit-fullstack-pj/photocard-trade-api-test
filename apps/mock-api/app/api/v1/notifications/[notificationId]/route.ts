import { getDb, handle, err, requireAuth } from "@/lib/api";
import { now } from "@/lib/store";

export const DELETE = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { notificationId } = await ctx.params;
  const n = db.notifications.find((x) => x.id === Number(notificationId));
  if (!n || n.userId !== user.id || n.deletedAt) err(404, "NOT_FOUND", "알림을 찾을 수 없습니다.");
  n.deletedAt = now();
  if (!n.isRead) user.unreadCount = Math.max(0, user.unreadCount - 1);
  return new Response(null, { status: 204 });
});
