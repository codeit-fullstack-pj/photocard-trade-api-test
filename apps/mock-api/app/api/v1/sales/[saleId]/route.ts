import { getDb, handle, json, err, requireAuth, readBody, optString } from "@/lib/api";
import { now, notify, saleJson } from "@/lib/store";

export const GET = handle(async (req, ctx) => {
  const db = getDb();
  const { saleId } = await ctx.params;
  const sale = db.sales.get(saleId);
  if (!sale) err(404, "NOT_FOUND", "판매글을 찾을 수 없습니다.");
  return json(saleJson(db, sale));
});

export const PATCH = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { saleId } = await ctx.params;
  const sale = db.sales.get(saleId);
  if (!sale) err(404, "NOT_FOUND", "판매글을 찾을 수 없습니다.");
  if (sale.seller !== user.id) err(403, "FORBIDDEN", "판매자만 수정할 수 있습니다.");
  if (sale.status !== "ON_SALE") err(409, "NOT_ON_SALE", "종료된 판매글은 수정할 수 없습니다.");
  const body = await readBody(req);
  const title = optString(body, "title", 20);
  const description = optString(body, "description", 500);
  let touched = false;
  if (title !== undefined) {
    if (title.trim() === "") err(400, "VALIDATION_FAILED", "title은 빈 값일 수 없습니다.");
    sale.title = title;
    touched = true;
  }
  if (description !== undefined) {
    sale.description = description === "" ? null : description;
    touched = true;
  }
  if (sale.type === "SALE" && body.price !== undefined) {
    const p = body.price;
    if (typeof p !== "number" || !Number.isInteger(p) || p < 1) err(400, "VALIDATION_FAILED", "price는 1 이상의 정수여야 합니다.");
    sale.price = p;
    touched = true;
  }
  if (sale.type === "EXCHANGE") {
    const wc = optString(body, "wishCategory", 3);
    if (wc !== undefined) {
      if (wc !== "DOG" && wc !== "CAT") err(400, "VALIDATION_FAILED", "wishCategory는 DOG 또는 CAT이어야 합니다.");
      sale.wishCategory = wc;
      touched = true;
    }
    const wd = optString(body, "wishDescription", 200);
    if (wd !== undefined) {
      sale.wishDescription = wd === "" ? null : wd;
      touched = true;
    }
  }
  if (!touched) err(400, "VALIDATION_FAILED", "수정할 필드가 없습니다.");
  sale.updatedAt = now();
  return json(saleJson(db, sale));
});

export const DELETE = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { saleId } = await ctx.params;
  const sale = db.sales.get(saleId);
  if (!sale) err(404, "NOT_FOUND", "판매글을 찾을 수 없습니다.");
  if (sale.seller !== user.id) err(403, "FORBIDDEN", "판매자만 취소할 수 있습니다.");
  if (sale.status !== "ON_SALE") err(409, "NOT_ON_SALE", "이미 종료된 판매글입니다.");
  const t = now();
  sale.status = "CANCELED";
  sale.closedAt = t;
  sale.updatedAt = t;
  for (const ex of db.exchanges.values()) {
    if (ex.saleId === sale.id && ex.status === "PENDING") {
      ex.status = "REJECTED";
      ex.respondedAt = t;
      notify(db, ex.offerer, "SALE_CANCELED", `오퍼를 넣은 '${sale.title}' 판매글이 취소되었습니다.`, sale.id);
    }
  }
  return new Response(null, { status: 204 });
});
