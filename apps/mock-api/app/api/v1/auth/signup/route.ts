import { getDb, handle, json, err, readBody, reqString, issueTokens } from "@/lib/api";
import { genId, now, userMeJson } from "@/lib/store";

export const POST = handle(async (req) => {
  const db = getDb();
  const body = await readBody(req);
  const email = reqString(body, "email", 100).toLowerCase();
  const password = reqString(body, "password", 72);
  const name = reqString(body, "name", 30);
  const nickname = reqString(body, "nickname", 20);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8)
    err(400, "VALIDATION_FAILED", "이메일 형식 또는 비밀번호 길이(8자 이상)를 확인해주세요.");
  if ([...db.users.values()].some((u) => !u.deletedAt && u.email === email))
    err(409, "EMAIL_EXISTS", "이미 가입된 이메일입니다.");
  const today = now();
  const user = {
    id: genId(db),
    name,
    nickname,
    email,
    password,
    providers: [],
    point: 0,
    dailyFreeLimit: 5,
    dailyCreatedCount: 0,
    dailyCountDate: "",
    unreadCount: 0,
    lastDrawAt: null,
    createdAt: today,
    deletedAt: null,
  };
  db.users.set(user.id, user);
  return json({ ...issueTokens(db, user.id), user: userMeJson(db, user) }, 201);
});
