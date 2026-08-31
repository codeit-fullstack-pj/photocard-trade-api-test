import { getDb, handle, json, err, readBody, reqString, issueTokens } from "@/lib/api";
import { userMeJson } from "@/lib/store";

export const POST = handle(async (req) => {
  const db = getDb();
  const body = await readBody(req);
  const refreshToken = reqString(body, "refreshToken", 200);
  const userId = db.refreshTokens.get(refreshToken);
  const user = userId ? db.users.get(userId) : undefined;
  if (!userId || !user || user.deletedAt) err(401, "UNAUTHORIZED", "유효하지 않은 refreshToken입니다.");
  db.refreshTokens.delete(refreshToken);
  return json({ ...issueTokens(db, user.id), user: userMeJson(db, user) });
});
