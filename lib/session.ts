import type { AdminPermissions } from "@/lib/auth/permissions";
import { getRedis } from "@/lib/redis";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export type SessionPayload = {
  sub: string;
  email?: string;
  name?: string;
  provider: "google" | "institucional";
  role: "student" | "admin";
  permissions?: AdminPermissions;
};

function sessionKey(sessionId: string) {
  return `session:${sessionId}`;
}

export async function createSession(
  payload: SessionPayload,
  ttlSeconds = SESSION_TTL_SECONDS,
) {
  const redis = await getRedis();
  const sessionId = crypto.randomUUID();
  await redis.set(sessionKey(sessionId), JSON.stringify(payload), {
    EX: ttlSeconds,
  });
  return {
    id: sessionId,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  };
}

export async function getSession(sessionId: string) {
  const redis = await getRedis();
  const data = await redis.get(sessionKey(sessionId));
  if (!data) return null;
  return JSON.parse(data) as SessionPayload;
}

export async function deleteSession(sessionId: string) {
  const redis = await getRedis();
  await redis.del(sessionKey(sessionId));
}

export async function refreshSession(
  sessionId: string,
  ttlSeconds = SESSION_TTL_SECONDS,
) {
  const redis = await getRedis();
  const updated = await redis.expire(sessionKey(sessionId), ttlSeconds);
  if (!updated) return null;
  return new Date(Date.now() + ttlSeconds * 1000);
}

// Adicionar em lib/session.ts
export async function updateSession(request: NextRequest) {
  const sessionId = request.cookies.get("session")?.value;

  if (!sessionId) return NextResponse.next(); // Não tem sessão, segue vida

  const payload = await getSession(sessionId);
  if (!payload) {
    const res = NextResponse.next();
    res.cookies.set({
      name: "session",
      value: "",
      expires: new Date(0),
      path: "/",
    });
    return res;
  }

  const expires =
    (await refreshSession(sessionId)) ??
    new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const res = NextResponse.next();
  res.cookies.set({
    name: "session",
    value: sessionId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expires,
    sameSite: "lax",
    path: "/",
  });

  return res;
}
