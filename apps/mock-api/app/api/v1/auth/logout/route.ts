import { getDb, handle, err, readBody, reqString, requireAuth } from "@/lib/api";

export const POST = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const body = await readBody(req);
  const refreshToken = reqString(body, "refreshToken", 200);
  if (db.refreshTokens.get(refreshToken) === user.id) db.refreshTokens.delete(refreshToken);
  else err(400, "VALIDATION_FAILED", "본인 소유의 refreshToken이 아닙니다.");
  return new Response(null, { status: 204 });
});
