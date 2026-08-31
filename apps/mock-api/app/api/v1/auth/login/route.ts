import { getDb, handle, json, err, readBody, reqString, issueTokens } from "@/lib/api";
import { userMeJson } from "@/lib/store";

export const POST = handle(async (req) => {
  const db = getDb();
  const body = await readBody(req);
  const email = reqString(body, "email", 100).toLowerCase();
  const password = reqString(body, "password", 72);
  const user = [...db.users.values()].find((u) => !u.deletedAt && u.email === email);
  if (!user || user.password !== password) err(401, "UNAUTHORIZED", "이메일 또는 비밀번호가 올바르지 않습니다.");
  return json({ ...issueTokens(db, user.id), user: userMeJson(db, user) });
});
