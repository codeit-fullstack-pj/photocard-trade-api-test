import { getDb, handle, json, err, requireAuth, pageParams } from "@/lib/api";
import { exchangeJson, paginate, type ExchangeStatus } from "@/lib/store";

const STATUSES: ExchangeStatus[] = ["PENDING", "ACCEPTED", "REJECTED", "CANCELED"];

export const GET = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const url = new URL(req.url);
  const { page, limit } = pageParams(url);
  const status = url.searchParams.get("status");
  if (status !== null && !STATUSES.includes(status as ExchangeStatus))
    err(400, "VALIDATION_FAILED", "status 값이 잘못되었습니다.");
  const items = [...db.exchanges.values()]
    .filter((e) => e.offerer === user.id && (!status || e.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const result = paginate(items, page, limit);
  return json({ ...result, items: result.items.map((e) => exchangeJson(db, e)) });
});
