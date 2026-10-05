import {
  getUserTypeFromEmail,
  isInstitutionalEmail,
  normalizeEmail,
} from "@/lib/auth/access-control";
import { getAuthStrategy } from "@/lib/auth/auth-factory";
import {
  EMPTY_ADMIN_PERMISSIONS,
  toAdminPermissions,
} from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { authProviderSchema } from "@/lib/schemas/auth.schema";
import { createSession } from "@/lib/session";
import { NextResponse } from "next/server";

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
  const parseResult = authProviderSchema.safeParse(provider);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Provedor de autenticação inválido." },
      { status: 400 },
    );
  }

  const strategy = getAuthStrategy(provider);
  const profile = await strategy.validateCallback(req);

  if (!profile.email) {
    if (provider === "institucional") {
      console.error("[CAS DEBUG] Perfil retornado sem email", {
        provider,
        profile,
        callbackUrl: req.url,
      });
    }
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

  let user = await db.user.findUnique({ where: { email } });
  const userType = getUserTypeFromEmail(email);
  const hasApprovedAdmins =
    userType === "ADMIN"
      ? (await db.user.count({
          where: { role: "ADMIN", accessStatus: "APPROVED" },
        })) > 0
      : true;
  const shouldBootstrapFirstAdmin = userType === "ADMIN" && !hasApprovedAdmins;

  if (!user) {
    if (shouldBootstrapFirstAdmin) {
      user = await db.user.create({
        data: {
          email,
          name: profile.name ?? undefined,
          role: "ADMIN",
          accessStatus: "APPROVED",
          reviewedAt: new Date(),
          canManageComplementar: true,
          canManageExtensao: true,
          canManageEstagio: true,
          canManageUsers: true,
        },
      });
    } else if (userType === "ADMIN") {
      user = await db.user.create({
        data: {
          email,
          name: profile.name ?? undefined,
          role: "ADMIN",
          accessStatus: "PENDING",
          canManageComplementar: false,
          canManageExtensao: false,
          canManageEstagio: false,
          canManageUsers: false,
        },
      });
    } else if (userType === "STUDENT") {
      user = await db.user.create({
        data: {
          email,
          name: profile.name ?? undefined,
          role: "STUDENT",
          accessStatus: "APPROVED",
        },
      });

      // user = await db.user.upsert({
      //   where: { email },
      //   update: {
      //     name: profile.name ?? undefined,
      //   },
      //   create: {
      //     email,
      //     name: profile.name ?? undefined,
      //     role: "STUDENT",
      //     accessStatus: "PENDING",
      //   },
      // });

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

  if (!user) {
    throw new Error("Usuário inválido durante o callback de autenticação");
  }

  const role = user.role === "ADMIN" ? "admin" : "student";
  const permissionRecord =
    role === "admin"
      ? await db.user.findUnique({
          where: { id: user.id },
          select: {
            canManageComplementar: true,
            canManageExtensao: true,
            canManageEstagio: true,
            canManageUsers: true,
          },
        })
      : null;
  const permissions =
    role === "admin" && permissionRecord
      ? toAdminPermissions(permissionRecord)
      : EMPTY_ADMIN_PERMISSIONS;

  const session = await createSession({
    sub: user.id,
    email,
    name: profile.name,
    provider: profile.provider,
    role,
    permissions,
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
