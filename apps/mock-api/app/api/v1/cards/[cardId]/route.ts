import { getDb, handle, json, err, requireAuth, readBody, optString } from "@/lib/api";
import { activeSaleOf, cancelPendingOffersWithCard, cardJson, cardOwnedJson, now } from "@/lib/store";

export const GET = handle(async (req, ctx) => {
  const db = getDb();
  const { cardId } = await ctx.params;
  const card = db.cards.get(cardId);
  if (!card || card.deletedAt) err(404, "NOT_FOUND", "카드를 찾을 수 없습니다.");
  return json(cardJson(db, card));
});

export const PATCH = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { cardId } = await ctx.params;
  const card = db.cards.get(cardId);
  if (!card || card.deletedAt) err(404, "NOT_FOUND", "카드를 찾을 수 없습니다.");
  if (card.owner !== user.id) err(403, "FORBIDDEN", "카드 소유자만 수정할 수 있습니다.");
  const body = await readBody(req);
  const title = optString(body, "title", 30);
  const description = optString(body, "description", 500);
  if (title === undefined && description === undefined) err(400, "VALIDATION_FAILED", "수정할 필드가 없습니다.");
  if (title !== undefined) {
    if (title.trim() === "") err(400, "VALIDATION_FAILED", "title은 빈 값일 수 없습니다.");
    card.title = title;
  }
  if (description !== undefined) card.description = description === "" ? null : description;
  card.updatedAt = now();
  return json(cardOwnedJson(db, card));
});

export const DELETE = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { cardId } = await ctx.params;
  const card = db.cards.get(cardId);
  if (!card || card.deletedAt) err(404, "NOT_FOUND", "카드를 찾을 수 없습니다.");
  if (card.owner !== user.id) err(403, "FORBIDDEN", "카드 소유자만 삭제할 수 있습니다.");
  if (activeSaleOf(db, card.id)) err(409, "ALREADY_ON_SALE", "판매 게시 중인 카드입니다. 판매글을 먼저 취소해주세요.");
  card.deletedAt = now();
  cancelPendingOffersWithCard(db, card.id);
  return new Response(null, { status: 204 });
});
