import { getDb, handle, json, err, requireAuth, readBody, reqString, optString, pageParams } from "@/lib/api";
import { activeSaleOf, exchangeJson, genId, now, notify, paginate, type Exchange } from "@/lib/store";

export const POST = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { saleId } = await ctx.params;
  const sale = db.sales.get(saleId);
  if (!sale) err(404, "NOT_FOUND", "판매글을 찾을 수 없습니다.");
  if (sale.type !== "EXCHANGE") err(409, "WRONG_SALE_TYPE", "판매글에는 오퍼할 수 없습니다. 구매를 이용해주세요.");
  if (sale.status !== "ON_SALE") err(409, "NOT_ON_SALE", "종료된 판매글입니다.");
  if (sale.seller === user.id) err(409, "SELF_DEAL", "자신의 판매글에는 오퍼할 수 없습니다.");
  const body = await readBody(req);
  const offerCardId = reqString(body, "offerCardId", 6);
  const message = optString(body, "message", 200);
  const offerCard = db.cards.get(offerCardId);
  if (!offerCard || offerCard.deletedAt) err(404, "NOT_FOUND", "오퍼 카드를 찾을 수 없습니다.");
  if (offerCard.owner !== user.id) err(403, "FORBIDDEN", "본인 소유 카드로만 오퍼할 수 있습니다.");
  if (activeSaleOf(db, offerCard.id)) err(409, "ALREADY_ON_SALE", "판매 게시 중인 카드로는 오퍼할 수 없습니다.");

  const exchange: Exchange = {
    id: genId(db),
    saleId: sale.id,
    offerer: user.id,
    offerCardId,
    message: message ?? null,
    status: "PENDING",
    createdAt: now(),
    respondedAt: null,
  };
  db.exchanges.set(exchange.id, exchange);
  notify(db, sale.seller, "EXCHANGE_OFFERED", `'${sale.title}' 판매글에 교환 오퍼가 도착했습니다.`, sale.id);
  return json(exchangeJson(db, exchange), 201);
});

export const GET = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { saleId } = await ctx.params;
  const sale = db.sales.get(saleId);
  if (!sale) err(404, "NOT_FOUND", "판매글을 찾을 수 없습니다.");
  if (sale.seller !== user.id) err(403, "FORBIDDEN", "판매자만 오퍼 목록을 볼 수 있습니다.");
  const url = new URL(req.url);
  const { page, limit } = pageParams(url);
  const items = [...db.exchanges.values()]
    .filter((e) => e.saleId === sale.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const result = paginate(items, page, limit);
  return json({ ...result, items: result.items.map((e) => exchangeJson(db, e)) });
});
