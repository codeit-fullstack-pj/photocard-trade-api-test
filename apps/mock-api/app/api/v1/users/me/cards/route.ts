import { getDb, handle, json, err, requireAuth, pageParams } from "@/lib/api";
import { cardOwnedJson, paginate, type Category } from "@/lib/store";

export const GET = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const url = new URL(req.url);
  const { page, limit } = pageParams(url);
  const category = url.searchParams.get("category");
  if (category !== null && category !== "DOG" && category !== "CAT")
    err(400, "VALIDATION_FAILED", "category는 DOG 또는 CAT이어야 합니다.");
  const cards = [...db.cards.values()]
    .filter((c) => c.owner === user.id && !c.deletedAt && (!category || c.category === (category as Category)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const result = paginate(cards, page, limit);
  return json({ ...result, items: result.items.map((c) => cardOwnedJson(db, c)) });
});
