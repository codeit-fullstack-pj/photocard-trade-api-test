import { getDb, handle, requireAuth } from "@/lib/api";

export const POST = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  for (const n of db.notifications) {
    if (n.userId === user.id && !n.deletedAt) n.isRead = true;
  }
  user.unreadCount = 0;
  return new Response(null, { status: 204 });
});
