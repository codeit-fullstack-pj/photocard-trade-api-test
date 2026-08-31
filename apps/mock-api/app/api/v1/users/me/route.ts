import { getDb, handle, json, err, readBody, optString, requireAuth, revokeUserTokens } from "@/lib/api";
import { activeSaleOf, now, userMeJson } from "@/lib/store";

export const GET = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  return json(userMeJson(db, user));
});

export const PATCH = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const body = await readBody(req);
  const name = optString(body, "name", 30);
  const nickname = optString(body, "nickname", 20);
  if (name === undefined && nickname === undefined) err(400, "VALIDATION_FAILED", "수정할 필드가 없습니다.");
  if (name !== undefined) {
    if (name.trim() === "") err(400, "VALIDATION_FAILED", "name은 빈 값일 수 없습니다.");
    user.name = name;
  }
  if (nickname !== undefined) {
    if (nickname.trim() === "") err(400, "VALIDATION_FAILED", "nickname은 빈 값일 수 없습니다.");
    user.nickname = nickname;
  }
  return json(userMeJson(db, user));
});

export const DELETE = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const t = now();
  for (const sale of db.sales.values()) {
    if (sale.seller === user.id && sale.status === "ON_SALE") {
      sale.status = "CANCELED";
      sale.closedAt = t;
      sale.updatedAt = t;
      for (const ex of db.exchanges.values()) {
        if (ex.saleId === sale.id && ex.status === "PENDING") {
          ex.status = "REJECTED";
          ex.respondedAt = t;
        }
      }
    }
  }
  for (const ex of db.exchanges.values()) {
    if (ex.status !== "PENDING") continue;
    if (ex.offerer === user.id) {
      ex.status = "CANCELED";
      ex.respondedAt = t;
    } else if (db.sales.get(ex.saleId)?.seller === user.id) {
      ex.status = "REJECTED";
      ex.respondedAt = t;
    }
  }
  for (const card of db.cards.values()) {
    if (card.owner === user.id && !card.deletedAt) {
      if (activeSaleOf(db, card.id)) continue;
      card.deletedAt = t;
    }
  }
  user.email = null;
  user.password = null;
  user.providers = [];
  user.nickname = "탈퇴한 사용자";
  user.deletedAt = t;
  revokeUserTokens(db, user.id);
  return new Response(null, { status: 204 });
});
