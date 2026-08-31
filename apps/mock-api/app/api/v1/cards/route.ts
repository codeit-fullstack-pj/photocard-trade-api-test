import { getDb, handle, json, err, requireAuth } from "@/lib/api";
import { analyzeDummy, cardOwnedJson, genId, now, rollDailyCount, tagOf, type Category } from "@/lib/store";
import { pixelSvg } from "@/lib/images";

const OVER_LIMIT_COST = 100;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

export const POST = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const form = await req.formData().catch(() => null);
  if (!form) err(400, "VALIDATION_FAILED", "multipart/form-data 본문이 필요합니다.");
  const image = form.get("image");
  const title = form.get("title");
  const category = form.get("category");
  const description = form.get("description");
  const usePoint = form.get("usePoint") === "true";
  if (!(image instanceof File)) err(400, "VALIDATION_FAILED", "image 파일이 필요합니다.");
  if (!ALLOWED_MIME.includes(image.type)) err(400, "VALIDATION_FAILED", "이미지는 jpeg/png/webp만 허용됩니다.");
  if (image.size > MAX_SIZE) err(400, "VALIDATION_FAILED", "이미지는 최대 10MB까지 허용됩니다.");
  if (typeof title !== "string" || title.trim() === "" || title.length > 30)
    err(400, "VALIDATION_FAILED", "title이 없거나 30자를 초과했습니다.");
  if (category !== "DOG" && category !== "CAT") err(400, "VALIDATION_FAILED", "category는 DOG 또는 CAT이어야 합니다.");
  if (typeof description === "string" && description.length > 500)
    err(400, "VALIDATION_FAILED", "description은 500자 이하여야 합니다.");

  rollDailyCount(user);
  let pointUsed = 0;
  if (user.dailyCreatedCount >= user.dailyFreeLimit) {
    if (!usePoint)
      err(409, "DAILY_LIMIT_EXCEEDED", `오늘 무료 생성 한도(${user.dailyFreeLimit}개)를 모두 사용했습니다. usePoint: true로 100포인트를 차감해 생성할 수 있습니다.`);
    if (user.point < OVER_LIMIT_COST) err(402, "INSUFFICIENT_POINT", "포인트가 부족합니다. (필요: 100)");
    user.point -= OVER_LIMIT_COST;
    pointUsed = OVER_LIMIT_COST;
  }

  const id = genId(db);
  const scores = analyzeDummy(category as Category);
  const t = now();
  const card = {
    id,
    owner: user.id,
    createdBy: user.id,
    createdOwnerNickname: user.nickname,
    title,
    category: category as Category,
    tag: tagOf(scores),
    scores,
    description: typeof description === "string" && description !== "" ? description : null,
    original: { data: Buffer.from(await image.arrayBuffer()), mime: image.type },
    pixel: { data: Buffer.from(pixelSvg(id, category as Category), "utf8"), mime: "image/svg+xml" },
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
  };
  db.cards.set(id, card);
  user.dailyCreatedCount += 1;
  return json({ card: cardOwnedJson(db, card), point: user.point, pointUsed }, 201);
});
