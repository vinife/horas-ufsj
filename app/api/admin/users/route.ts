import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  isInstitutionalEmail,
  isMasterAdminEmail,
  normalizeEmail,
} from "@/lib/auth/access-control";

type ManagedRole = "STUDENT" | "ADMIN";
type ManagedAccessStatus = "PENDING" | "APPROVED" | "REJECTED";

function parseManagedRole(value: string | null | undefined): ManagedRole {
  return value === "ADMIN" ? "ADMIN" : "STUDENT";
}

function parseRoleFilter(value: string | null | undefined): ManagedRole | null {
  if (value === "ADMIN" || value === "STUDENT") return value;
  return null;
}

function parseManagedAccessStatus(
  value: string | null | undefined,
): ManagedAccessStatus | null {
  if (value === "PENDING" || value === "APPROVED" || value === "REJECTED") {
    return value;
  }
  return null;
}

async function getAdminContext(request: NextRequest) {
  const sessionId = request.cookies.get("session")?.value;
  if (!sessionId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const session = await getSession(sessionId);
  if (!session || session.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const canManage =
    Boolean(session.isMasterAdmin) || isMasterAdminEmail(session.email);

  return { session, canManage };
}

export async function GET(request: NextRequest) {
  const context = await getAdminContext(request);
  if ("error" in context) return context.error;

  const searchParams = request.nextUrl.searchParams;
  const roleFilter = parseRoleFilter(searchParams.get("role"));
  const accessStatusFilter = parseManagedAccessStatus(
    searchParams.get("accessStatus"),
  );
  const query = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.max(
    1,
    parseInt(searchParams.get("pageSize") ?? "10", 10),
  );
  const skip = (page - 1) * pageSize;

  const where = {
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(accessStatusFilter ? { accessStatus: accessStatusFilter } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, totalCount, pendingCount] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ accessStatus: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessStatus: true,
        createdAt: true,
      },
    }),
    db.user.count({ where }),
    db.user.count({ where: { accessStatus: "PENDING" } }),
  ]);

  return NextResponse.json(
    {
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accessStatus: user.accessStatus,
        createdAt: user.createdAt,
        isMasterAdmin: isMasterAdminEmail(user.email),
      })),
      meta: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
        pageSize,
        pendingItems: pendingCount,
      },
      canManage: context.canManage,
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const context = await getAdminContext(request);
  if ("error" in context) return context.error;
  if (!context.canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { email?: string; role?: string; name?: string }
    | null;
  if (!body?.email) {
    return NextResponse.json({ error: "Email obrigatório" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!isInstitutionalEmail(email)) {
    return NextResponse.json(
      { error: "Somente emails institucionais são permitidos." },
      { status: 400 },
    );
  }

  const role = parseManagedRole(body.role);
  if (isMasterAdminEmail(email) && role !== "ADMIN") {
    return NextResponse.json(
      { error: "Conta master admin deve permanecer como ADMIN." },
      { status: 400 },
    );
  }

  const cleanName = body.name?.trim() || null;
  const user = await db.user.upsert({
    where: { email },
    update: {
      role,
      accessStatus: "APPROVED",
      reviewedAt: new Date(),
      reviewNote: null,
      ...(cleanName ? { name: cleanName } : {}),
    },
    create: {
      email,
      role,
      accessStatus: "APPROVED",
      reviewedAt: new Date(),
      reviewNote: null,
      ...(cleanName ? { name: cleanName } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accessStatus: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      user: {
        ...user,
        isMasterAdmin: isMasterAdminEmail(user.email),
      },
    },
    { status: 200 },
  );
}

export async function PATCH(request: NextRequest) {
  const context = await getAdminContext(request);
  if ("error" in context) return context.error;
  if (!context.canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        userId?: string;
        status?: string;
        role?: string;
        reason?: string;
      }
    | null;

  if (!body?.userId) {
    return NextResponse.json({ error: "userId obrigatório" }, { status: 400 });
  }

  const status = parseManagedAccessStatus(body.status);
  if (!status) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const existingUser = await db.user.findUnique({
    where: { id: body.userId },
    select: { id: true, email: true, role: true },
  });

  if (!existingUser) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  if (isMasterAdminEmail(existingUser.email) && status !== "APPROVED") {
    return NextResponse.json(
      { error: "Conta master admin não pode ser negada." },
      { status: 400 },
    );
  }

  const role = parseManagedRole(body.role);
  const user = await db.user.update({
    where: { id: existingUser.id },
    data: {
      accessStatus: status,
      reviewedAt: new Date(),
      reviewNote:
        status === "REJECTED" ? body.reason?.trim() || "Solicitação negada." : null,
      ...(status === "APPROVED"
        ? { role: isMasterAdminEmail(existingUser.email) ? "ADMIN" : role }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accessStatus: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      user: {
        ...user,
        isMasterAdmin: isMasterAdminEmail(user.email),
      },
    },
    { status: 200 },
  );
}
