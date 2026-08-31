import { NextResponse } from "next/server";
import { getDb, now, type DB, type User } from "./store";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function err(status: number, code: string, message: string, extra?: Record<string, unknown>): never {
  throw new ApiError(status, code, message, extra);
}

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

export function handle(fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ code: e.code, message: e.message, ...e.extra }, { status: e.status });
      }
      console.error(e);
      return NextResponse.json({ code: "INTERNAL_ERROR", message: "요청을 처리할 수 없습니다." }, { status: 500 });
    }
  };
}

const ACCESS_TTL = 3600;

export function issueTokens(db: DB, userId: string): { accessToken: string; refreshToken: string; expiresIn: number } {
  const accessToken = `mock_at_${crypto.randomUUID().replaceAll("-", "")}`;
  const refreshToken = `mock_rt_${crypto.randomUUID().replaceAll("-", "")}`;
  db.accessTokens.set(accessToken, { userId, exp: Date.now() + ACCESS_TTL * 1000 });
  db.refreshTokens.set(refreshToken, userId);
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL };
}

export function revokeUserTokens(db: DB, userId: string): void {
  for (const [t, v] of db.accessTokens) if (v.userId === userId) db.accessTokens.delete(t);
  for (const [t, uid] of db.refreshTokens) if (uid === userId) db.refreshTokens.delete(t);
}

export function optionalAuth(db: DB, req: Request): User | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const entry = db.accessTokens.get(header.slice(7));
  if (!entry || entry.exp < Date.now()) return null;
  const user = db.users.get(entry.userId);
  return user && !user.deletedAt ? user : null;
}

export function requireAuth(db: DB, req: Request): User {
  const user = optionalAuth(db, req);
  if (!user) err(401, "UNAUTHORIZED", "유효한 토큰이 필요합니다.");
  return user;
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") err(400, "VALIDATION_FAILED", "JSON 본문이 필요합니다.");
  return body;
}

export function reqString(body: Record<string, unknown>, key: string, maxLength: number): string {
  const v = body[key];
  if (typeof v !== "string" || v.trim() === "" || v.length > maxLength)
    err(400, "VALIDATION_FAILED", `${key} 필드가 없거나 형식이 잘못되었습니다.`);
  return v;
}

export function optString(body: Record<string, unknown>, key: string, maxLength: number): string | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string" || v.length > maxLength) err(400, "VALIDATION_FAILED", `${key} 필드 형식이 잘못되었습니다.`);
  return v;
}

export function pageParams(url: URL): { page: number; limit: number } {
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "20");
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    err(400, "VALIDATION_FAILED", "page/limit 값이 잘못되었습니다.");
  return { page, limit };
}

export { getDb, now };
