import { getDb, handle, err, requireAuth } from "@/lib/api";
import { now } from "@/lib/store";

export const DELETE = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { exchangeId } = await ctx.params;
  const exchange = db.exchanges.get(exchangeId);
  if (!exchange) err(404, "NOT_FOUND", "오퍼를 찾을 수 없습니다.");
  if (exchange.offerer !== user.id) err(403, "FORBIDDEN", "오퍼를 보낸 본인만 취소할 수 있습니다.");
  if (exchange.status !== "PENDING") err(409, "EXCHANGE_NOT_PENDING", "대기 상태의 오퍼가 아닙니다.");
  exchange.status = "CANCELED";
  exchange.respondedAt = now();
  return new Response(null, { status: 204 });
});
