import { getDb, handle, json, err, requireAuth } from "@/lib/api";
import { exchangeJson, now, notify } from "@/lib/store";

export const POST = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { exchangeId } = await ctx.params;
  const exchange = db.exchanges.get(exchangeId);
  if (!exchange) err(404, "NOT_FOUND", "오퍼를 찾을 수 없습니다.");
  const sale = db.sales.get(exchange.saleId)!;
  if (sale.seller !== user.id) err(403, "FORBIDDEN", "판매자만 거절할 수 있습니다.");
  if (exchange.status !== "PENDING") err(409, "EXCHANGE_NOT_PENDING", "대기 상태의 오퍼가 아닙니다.");
  exchange.status = "REJECTED";
  exchange.respondedAt = now();
  notify(db, exchange.offerer, "EXCHANGE_REJECTED", `'${sale.title}' 판매글의 오퍼가 거절되었습니다.`, exchange.id);
  return json(exchangeJson(db, exchange));
});
