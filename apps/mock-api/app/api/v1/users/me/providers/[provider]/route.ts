import { getDb, handle, err, requireAuth } from "@/lib/api";

export const DELETE = handle(async (req, ctx) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const { provider } = await ctx.params;
  const idx = user.providers.findIndex((p) => p.provider === provider);
  if (idx === -1) err(404, "NOT_FOUND", "연동되지 않은 provider입니다.");
  if (user.providers.length === 1 && user.password === null)
    err(409, "LAST_PROVIDER", "마지막 로그인 수단은 해지할 수 없습니다.");
  user.providers.splice(idx, 1);
  return new Response(null, { status: 204 });
});
