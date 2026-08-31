import { getDb, handle, json, err, readBody, reqString, issueTokens } from "@/lib/api";
import { genId, now, userMeJson, type Provider } from "@/lib/store";

const PROVIDERS: Provider[] = ["GOOGLE", "KAKAO", "NAVER"];

export const POST = handle(async (req) => {
  const db = getDb();
  const body = await readBody(req);
  const provider = reqString(body, "provider", 20) as Provider;
  const providerToken = reqString(body, "providerToken", 2048);
  if (!PROVIDERS.includes(provider)) err(400, "VALIDATION_FAILED", "provider는 GOOGLE/KAKAO/NAVER 중 하나여야 합니다.");
  const providerId = `${provider.toLowerCase()}-${providerToken.slice(0, 24)}`;
  let user = [...db.users.values()].find(
    (u) => !u.deletedAt && u.providers.some((p) => p.provider === provider && p.providerId === providerId),
  );
  const isNewUser = !user;
  if (!user) {
    const suffix = genId(db).slice(0, 4).toLowerCase();
    user = {
      id: genId(db),
      name: `${provider} 사용자`,
      nickname: `user-${suffix}`,
      email: null,
      password: null,
      providers: [{ provider, providerId }],
      point: 0,
      dailyFreeLimit: 5,
      dailyCreatedCount: 0,
      dailyCountDate: "",
      unreadCount: 0,
      lastDrawAt: null,
      createdAt: now(),
      deletedAt: null,
    };
    db.users.set(user.id, user);
  }
  return json({ ...issueTokens(db, user.id), user: userMeJson(db, user), isNewUser });
});
