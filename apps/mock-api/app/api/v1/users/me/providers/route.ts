import { getDb, handle, json, err, readBody, reqString, requireAuth } from "@/lib/api";
import { userMeJson, type Provider } from "@/lib/store";

const PROVIDERS: Provider[] = ["GOOGLE", "KAKAO", "NAVER"];

export const POST = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const body = await readBody(req);
  const provider = reqString(body, "provider", 20) as Provider;
  const providerToken = reqString(body, "providerToken", 2048);
  if (!PROVIDERS.includes(provider)) err(400, "VALIDATION_FAILED", "provider는 GOOGLE/KAKAO/NAVER 중 하나여야 합니다.");
  if (user.providers.some((p) => p.provider === provider))
    err(409, "PROVIDER_ALREADY_LINKED", "이미 연동된 provider입니다.");
  user.providers.push({ provider, providerId: `${provider.toLowerCase()}-${providerToken.slice(0, 24)}` });
  return json(userMeJson(db, user));
});
