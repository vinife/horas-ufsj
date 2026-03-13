import { NextResponse } from "next/server";
import { getAuthStrategy } from "@/lib/auth/auth-factory";
import { createSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  isInstitutionalEmail,
  isMasterAdminEmail,
  normalizeEmail,
} from "@/lib/auth/access-control";

function clearGoogleCookies(res: NextResponse) {
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

  const email = normalizeEmail(profile.email);
  if (!isInstitutionalEmail(email)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "unauthorized-domain");
    const res = NextResponse.redirect(url);
    if (provider === "google") clearGoogleCookies(res);
    return res;
  }

  const isMasterAdmin = isMasterAdminEmail(email);
  let user = await db.user.findUnique({ where: { email } });

  if (!user) {
    if (isMasterAdmin) {
      user = await db.user.create({
        data: {
          email,
          name: profile.name ?? undefined,
          role: "ADMIN",
          accessStatus: "APPROVED",
          reviewedAt: new Date(),
          reviewNote: null,
        },
      });
    } else {
      user = await db.user.upsert({
        where: { email },
        update: {
          name: profile.name ?? undefined,
        },
        create: {
          email,
          name: profile.name ?? undefined,
          role: "STUDENT",
          accessStatus: "PENDING",
        },
      });

      if (user.accessStatus !== "APPROVED") {
        const url = new URL("/login", req.url);
        url.searchParams.set(
          "error",
          user.accessStatus === "REJECTED"
            ? "access-rejected"
            : "pending-approval",
        );
        const res = NextResponse.redirect(url);
        if (provider === "google") clearGoogleCookies(res);
        return res;
      }
    }
  } else if (isMasterAdmin) {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        name: profile.name ?? user.name ?? undefined,
        role: "ADMIN",
        accessStatus: "APPROVED",
        reviewedAt: user.accessStatus === "APPROVED" ? user.reviewedAt : new Date(),
        reviewNote: null,
      },
    });
  } else if (user.accessStatus !== "APPROVED") {
    await db.user.update({
      where: { id: user.id },
      data: {
        name: profile.name ?? user.name ?? undefined,
      },
    });

    const url = new URL("/login", req.url);
    url.searchParams.set(
      "error",
      user.accessStatus === "REJECTED" ? "access-rejected" : "pending-approval",
    );
    const res = NextResponse.redirect(url);
    if (provider === "google") clearGoogleCookies(res);
    return res;
  } else {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        name: profile.name ?? user.name ?? undefined,
      },
    });
  }

  const role = user.role === "ADMIN" ? "admin" : "student";

  const session = await createSession({
    sub: user.id,
    email,
    name: profile.name,
    provider: profile.provider,
    role,
    isMasterAdmin,
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

  if (provider === "google") clearGoogleCookies(res);

  return res;
}
