import { getDb, handle, json, err, requireAuth, readBody, reqString, optString, pageParams } from "@/lib/api";
import {
  activeSaleOf,
  cancelPendingOffersWithCard,
  genId,
  now,
  paginate,
  saleJson,
  type Category,
  type Sale,
  type SaleStatus,
  type TraitCode,
} from "@/lib/store";
import { TRAITS } from "@/lib/traits";

const STATUSES: SaleStatus[] = ["ON_SALE", "SOLD", "EXCHANGED", "CANCELED"];
const SORTS = ["LATEST", "OLDEST", "PRICE_ASC", "PRICE_DESC"] as const;
const ALL_TRAITS = [...TRAITS.DOG, ...TRAITS.CAT].map((t) => t.code);

export const POST = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const body = await readBody(req);
  const cardId = reqString(body, "cardId", 6);
  const type = reqString(body, "type", 10);
  const title = reqString(body, "title", 20);
  const description = optString(body, "description", 500);
  if (type !== "SALE" && type !== "EXCHANGE") err(400, "VALIDATION_FAILED", "type은 SALE 또는 EXCHANGE여야 합니다.");
  const card = db.cards.get(cardId);
  if (!card || card.deletedAt) err(404, "NOT_FOUND", "카드를 찾을 수 없습니다.");
  if (card.owner !== user.id) err(403, "FORBIDDEN", "본인 소유 카드만 등록할 수 있습니다.");
  if (activeSaleOf(db, card.id)) err(409, "ALREADY_ON_SALE", "이미 판매 게시 중인 카드입니다.");

  let price: number | null = null;
  let wishCategory: Category | null = null;
  let wishDescription: string | null = null;
  if (type === "SALE") {
    const p = body.price;
    if (typeof p !== "number" || !Number.isInteger(p) || p < 1) err(400, "VALIDATION_FAILED", "SALE은 1 이상의 정수 price가 필수입니다.");
    price = p;
  } else {
    const wc = optString(body, "wishCategory", 3);
    if (wc !== undefined && wc !== "DOG" && wc !== "CAT") err(400, "VALIDATION_FAILED", "wishCategory는 DOG 또는 CAT이어야 합니다.");
    wishCategory = (wc as Category | undefined) ?? null;
    wishDescription = optString(body, "wishDescription", 200) ?? null;
  }

  const t = now();
  const sale: Sale = {
    id: genId(db),
    cardId,
    seller: user.id,
    type,
    status: "ON_SALE",
    title,
    description: description ?? null,
    price,
    wishCategory,
    wishDescription,
    createdAt: t,
    updatedAt: t,
    closedAt: null,
  };
  db.sales.set(sale.id, sale);
  cancelPendingOffersWithCard(db, cardId);
  return json(saleJson(db, sale), 201);
});

export const GET = handle(async (req) => {
  const db = getDb();
  const url = new URL(req.url);
  const { page, limit } = pageParams(url);
  const type = url.searchParams.get("type");
  if (type !== null && type !== "SALE" && type !== "EXCHANGE") err(400, "VALIDATION_FAILED", "type 값이 잘못되었습니다.");
  const statusParams = url.searchParams.getAll("status");
  if (statusParams.some((s) => !STATUSES.includes(s as SaleStatus))) err(400, "VALIDATION_FAILED", "status 값이 잘못되었습니다.");
  const statuses: SaleStatus[] = statusParams.length > 0 ? (statusParams as SaleStatus[]) : ["ON_SALE"];
  const category = url.searchParams.get("category");
  if (category !== null && category !== "DOG" && category !== "CAT") err(400, "VALIDATION_FAILED", "category 값이 잘못되었습니다.");
  const traits = url.searchParams.getAll("trait");
  if (traits.some((tr) => !ALL_TRAITS.includes(tr as TraitCode))) err(400, "VALIDATION_FAILED", "trait 값이 잘못되었습니다.");
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length > 50) err(400, "VALIDATION_FAILED", "검색어는 50자 이하여야 합니다.");
  const sort = url.searchParams.get("sort") ?? "LATEST";
  if (!SORTS.includes(sort as (typeof SORTS)[number])) err(400, "VALIDATION_FAILED", "sort 값이 잘못되었습니다.");
  const sellerId = url.searchParams.get("sellerId");

  let list = [...db.sales.values()].filter((s) => {
    const card = db.cards.get(s.cardId);
    if (!card) return false;
    if (!statuses.includes(s.status)) return false;
    if (type && s.type !== type) return false;
    if (category && card.category !== category) return false;
    if (sellerId && s.seller !== sellerId) return false;
    if (traits.length > 0) {
      const top2 = card.scores.slice(0, 2).map((sc) => sc.code as string);
      if (!traits.some((tr) => top2.includes(tr))) return false;
    }
    if (q !== "") {
      const haystack = [s.title, s.description ?? "", card.title, card.tag].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  list = list.sort((a, b) => {
    switch (sort) {
      case "OLDEST":
        return a.createdAt.localeCompare(b.createdAt);
      case "PRICE_ASC":
      case "PRICE_DESC": {
        if (a.price === null && b.price === null) return b.createdAt.localeCompare(a.createdAt);
        if (a.price === null) return 1;
        if (b.price === null) return -1;
        return sort === "PRICE_ASC" ? a.price - b.price : b.price - a.price;
      }
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });

  const result = paginate(list, page, limit);
  return json({ ...result, items: result.items.map((s) => saleJson(db, s)) });
});
