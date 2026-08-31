import { getDb, handle, json, err, requireAuth } from "@/lib/api";
import { cancelPendingOffersWithCard, cardOwnedJson, now, notify, saleJson } from "@/lib/store";

export const POST = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { saleId } = await ctx.params;
  const sale = db.sales.get(saleId);
  if (!sale) err(404, "NOT_FOUND", "판매글을 찾을 수 없습니다.");
  if (sale.type !== "SALE") err(409, "WRONG_SALE_TYPE", "교환글은 구매할 수 없습니다. 교환 오퍼를 이용해주세요.");
  if (sale.status !== "ON_SALE") err(409, "NOT_ON_SALE", "종료된 판매글입니다.");
  if (sale.seller === user.id) err(409, "SELF_DEAL", "자신의 판매글은 구매할 수 없습니다.");
  const price = sale.price ?? 0;
  if (user.point < price) err(402, "INSUFFICIENT_POINT", `포인트가 부족합니다. (필요: ${price}, 보유: ${user.point})`);

  const card = db.cards.get(sale.cardId)!;
  const seller = db.users.get(sale.seller);
  const t = now();
  user.point -= price;
  if (seller && !seller.deletedAt) seller.point += price;
  card.owner = user.id;
  card.updatedAt = t;
  sale.status = "SOLD";
  sale.closedAt = t;
  sale.updatedAt = t;
  cancelPendingOffersWithCard(db, card.id);
  notify(db, sale.seller, "SALE_SOLD", `'${sale.title}' 판매글이 판매되었습니다. (+${price}P)`, sale.id);
  return json({ sale: saleJson(db, sale), card: cardOwnedJson(db, card), point: user.point });
});
