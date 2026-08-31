import { getDb, handle, err, readBody, reqString, requireAuth, revokeUserTokens } from "@/lib/api";

export const PATCH = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const body = await readBody(req);
  const currentPassword = reqString(body, "currentPassword", 72);
  const newPassword = reqString(body, "newPassword", 72);
  if (user.password === null) err(409, "NO_PASSWORD_ACCOUNT", "소셜 전용 계정은 비밀번호를 변경할 수 없습니다.");
  if (user.password !== currentPassword) err(401, "UNAUTHORIZED", "현재 비밀번호가 올바르지 않습니다.");
  if (newPassword.length < 8) err(400, "VALIDATION_FAILED", "새 비밀번호는 8자 이상이어야 합니다.");
  user.password = newPassword;
  revokeUserTokens(db, user.id);
  return new Response(null, { status: 204 });
});
