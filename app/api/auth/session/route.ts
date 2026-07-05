import {
  EMPTY_ADMIN_PERMISSIONS,
  hasAnyAdminPermission,
  toAdminPermissions,
} from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get("session")?.value;
  if (!sessionId) return NextResponse.json({ user: null }, { status: 200 });

  const session = await getSession(sessionId);
  if (!session) return NextResponse.json({ user: null }, { status: 200 });

  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accessStatus: true,
      canManageComplementar: true,
      canManageExtensao: true,
      canManageUsers: true,
    },
  });

  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const permissions =
    user.role === "ADMIN" ? toAdminPermissions(user) : EMPTY_ADMIN_PERMISSIONS;
  const hasAnyPermission = hasAnyAdminPermission(permissions);

  const responsibleEmails =
    user.role === "ADMIN" && !hasAnyPermission
      ? (
          await db.user.findMany({
            where: {
              role: "ADMIN",
              accessStatus: "APPROVED",
              canManageUsers: true,
            },
            select: { email: true },
            orderBy: { email: "asc" },
          })
        ).map((manager) => manager.email)
      : [];

  return NextResponse.json(
    {
      user: {
        id: user.id,
        name: user.name ?? session.name,
        email: user.email ?? session.email,
        role: user.role === "ADMIN" ? "admin" : "student",
        accessStatus: user.accessStatus,
        permissions,
        hasAnyAdminPermission: hasAnyPermission,
        responsibleEmails,
      },
    },
    { status: 200 },
  );
}
