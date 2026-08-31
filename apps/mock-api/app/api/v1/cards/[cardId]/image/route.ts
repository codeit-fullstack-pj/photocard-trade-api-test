import { getDb, handle, err, optionalAuth } from "@/lib/api";

export const GET = handle(async (req, ctx) => {
  const db = getDb();
  const { cardId } = await ctx.params;
  const card = db.cards.get(cardId);
  if (!card || card.deletedAt) err(404, "NOT_FOUND", "카드를 찾을 수 없습니다.");
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "pixel";
  if (type !== "pixel" && type !== "original") err(400, "VALIDATION_FAILED", "type은 pixel 또는 original이어야 합니다.");
  if (type === "original") {
    const user = optionalAuth(db, req);
    if (!user) err(401, "UNAUTHORIZED", "원본 이미지는 인증이 필요합니다.");
    if (card.owner !== user.id) err(403, "FORBIDDEN", "원본 이미지는 카드 소유자만 볼 수 있습니다.");
  }
  const image = type === "original" ? card.original : card.pixel;
  return new Response(new Uint8Array(image.data), {
    headers: { "content-type": image.mime, "cache-control": "no-store" },
  });
});
