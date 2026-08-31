import { getDb, handle, json, err, requireAuth } from "@/lib/api";
import { cardOwnedJson, exchangeJson, now, notify } from "@/lib/store";

export const POST = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { exchangeId } = await ctx.params;
  const exchange = db.exchanges.get(exchangeId);
  if (!exchange) err(404, "NOT_FOUND", "오퍼를 찾을 수 없습니다.");
  const sale = db.sales.get(exchange.saleId)!;
  if (sale.seller !== user.id) err(403, "FORBIDDEN", "판매자만 수락할 수 있습니다.");
  if (exchange.status !== "PENDING") err(409, "EXCHANGE_NOT_PENDING", "대기 상태의 오퍼가 아닙니다.");
  if (sale.status !== "ON_SALE") err(409, "NOT_ON_SALE", "종료된 판매글입니다.");
  const offerCard = db.cards.get(exchange.offerCardId)!;
  const t = now();
  if (offerCard.deletedAt || offerCard.owner !== exchange.offerer) {
    exchange.status = "CANCELED";
    exchange.respondedAt = t;
    err(409, "OFFER_CARD_UNAVAILABLE", "오퍼 카드의 소유권이 변경되어 오퍼가 자동 취소되었습니다.");
  }

  const myCard = db.cards.get(sale.cardId)!;
  myCard.owner = exchange.offerer;
  myCard.updatedAt = t;
  offerCard.owner = user.id;
  offerCard.updatedAt = t;
  exchange.status = "ACCEPTED";
  exchange.respondedAt = t;
  sale.status = "EXCHANGED";
  sale.closedAt = t;
  sale.updatedAt = t;
  for (const other of db.exchanges.values()) {
    if (other.saleId === sale.id && other.status === "PENDING") {
      other.status = "REJECTED";
      other.respondedAt = t;
      notify(db, other.offerer, "EXCHANGE_REJECTED", `'${sale.title}' 판매글의 오퍼가 거절되었습니다.`, other.id);
    }
  }
  notify(db, exchange.offerer, "EXCHANGE_ACCEPTED", `'${sale.title}' 판매글의 오퍼가 수락되었습니다.`, exchange.id);
  return json({ exchange: exchangeJson(db, exchange), receivedCard: cardOwnedJson(db, offerCard) });
});
