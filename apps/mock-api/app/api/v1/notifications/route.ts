import { getDb, handle, json, requireAuth, pageParams } from "@/lib/api";
import { notiJson, now, paginate } from "@/lib/store";

export const GET = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const url = new URL(req.url);
  const { page, limit } = pageParams(url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const items = db.notifications
    .filter((n) => n.userId === user.id && !n.deletedAt && (!unreadOnly || !n.isRead))
    .sort((a, b) => b.id - a.id);
  const result = paginate(items, page, limit);
  return json({ ...result, items: result.items.map(notiJson) });
});

export const DELETE = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const t = now();
  for (const n of db.notifications) {
    if (n.userId === user.id && !n.deletedAt) {
      n.deletedAt = t;
      if (!n.isRead) user.unreadCount = Math.max(0, user.unreadCount - 1);
    }
  }
  return new Response(null, { status: 204 });
});
