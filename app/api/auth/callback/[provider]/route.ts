import { NextResponse } from "next/server";
import { getAuthStrategy } from "@/lib/auth/auth-factory";
import { createSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const strategy = getAuthStrategy(provider);
  const profile = await strategy.validateCallback(req);

  if (!profile.email) {
    throw new Error("Email obrigatório para login");
  }

  const email = profile.email.toLowerCase();
  const user = await db.user.upsert({
    where: { email },
    update: { name: profile.name ?? undefined },
    create: {
      email,
      name: profile.name ?? undefined,
      role: "STUDENT",
    },
  });

  const role = user.role === "ADMIN" ? "admin" : "student";

  const session = await createSession({
    sub: user.id,
    email,
    name: profile.name,
    provider: profile.provider,
    role,
  });

  const redirectPath = role === "admin" ? "/admin" : "/student";
  const redirectUrl = new URL(redirectPath, req.url);
  const res = NextResponse.redirect(redirectUrl);

  res.cookies.set({
    name: "session",
    value: session.id,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });

  if (provider === "google") {
    for (const name of [
      "oauth_state_google",
      "oauth_nonce_google",
      "oauth_pkce_google",
    ]) {
      res.cookies.set({
        name,
        value: "",
        expires: new Date(0),
        path: "/",
      });
    }
  }

  return res;
}
