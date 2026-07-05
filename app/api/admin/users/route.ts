import {
  isInstitutionalEmail,
  normalizeEmail,
} from "@/lib/auth/access-control";
import { toAdminPermissions } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import {
  createUserSchema,
  updateUserStatusSchema,
  userListQuerySchema,
} from "@/lib/schemas/user.schema";
import { getSession } from "@/lib/session";
import {
  validateJsonRequest,
  validateQueryParams,
} from "@/lib/validators/validate-request";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

async function getAdminContext(request: NextRequest) {
  const sessionId = request.cookies.get("session")?.value;
  if (!sessionId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const session = await getSession(sessionId);
  if (!session || session.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const adminUser = await db.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      role: true,
      accessStatus: true,
      canManageUsers: true,
    },
  });

  if (!adminUser || adminUser.role !== "ADMIN") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (adminUser.accessStatus !== "APPROVED") {
    return {
      error: NextResponse.json(
        { error: "Conta sem aprovação." },
        { status: 403 },
      ),
    };
  }

  return { session, adminUser, canManage: Boolean(adminUser.canManageUsers) };
}

export async function GET(request: NextRequest) {
  const context = await getAdminContext(request);
  if ("error" in context) return context.error;
  if (!context.canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const query = validateQueryParams(
    request.nextUrl.searchParams,
    userListQuerySchema,
  );
  if (query instanceof Response) return query;

  const roleFilter = query.role;
  const accessStatusFilter = query.accessStatus;
  const search = query.q.trim();
  const page = query.page;
  const pageSize = query.pageSize;
  const skip = (page - 1) * pageSize;

  const where = {
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(accessStatusFilter ? { accessStatus: accessStatusFilter } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
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
        canManageComplementar: true,
        canManageExtensao: true,
        canManageUsers: true,
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
        permissions: toAdminPermissions(user),
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

  const bodyOrResponse = await validateJsonRequest(request, createUserSchema);
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const email = normalizeEmail(body.email);
  if (!isInstitutionalEmail(email)) {
    return NextResponse.json(
      { error: "Somente emails institucionais são permitidos." },
      { status: 400 },
    );
  }

  const role = body.role ?? "STUDENT";

  const cleanName = body.name?.trim() || null;
  const defaultPermissions = {
    canManageComplementar: false,
    canManageExtensao: false,
    canManageUsers: false,
  };
  const user = await db.user.upsert({
    where: { email },
    update: {
      role,
      accessStatus: "APPROVED",
      reviewedAt: new Date(),
      ...defaultPermissions,
      ...(cleanName ? { name: cleanName } : {}),
    },
    create: {
      email,
      role,
      accessStatus: "APPROVED",
      reviewedAt: new Date(),
      ...defaultPermissions,
      ...(cleanName ? { name: cleanName } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accessStatus: true,
      createdAt: true,
      canManageComplementar: true,
      canManageExtensao: true,
      canManageUsers: true,
    },
  });

  return NextResponse.json(
    {
      user: {
        ...user,
        permissions: toAdminPermissions(user),
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

  const bodyOrResponse = await validateJsonRequest(
    request,
    updateUserStatusSchema,
  );
  if (bodyOrResponse instanceof Response) return bodyOrResponse;
  const body = bodyOrResponse;

  const status = body.status;

  const existingUser = await db.user.findUnique({
    where: { id: body.userId },
    select: {
      id: true,
      role: true,
      accessStatus: true,
      canManageComplementar: true,
      canManageExtensao: true,
      canManageUsers: true,
    },
  });

  if (!existingUser) {
    return NextResponse.json(
      { error: "Usuário não encontrado" },
      { status: 404 },
    );
  }

  const role = body.role ?? existingUser.role;
  const isApproving = status === "APPROVED";
  const nextPermissions =
    role === "ADMIN"
      ? {
          canManageComplementar:
            body.canManageComplementar ?? existingUser.canManageComplementar,
          canManageExtensao:
            body.canManageExtensao ?? existingUser.canManageExtensao,
          canManageUsers: body.canManageUsers ?? existingUser.canManageUsers,
        }
      : {
          canManageComplementar: false,
          canManageExtensao: false,
          canManageUsers: false,
        };

  const willKeepManageUsers =
    role === "ADMIN" && isApproving && nextPermissions.canManageUsers;

  if (
    existingUser.role === "ADMIN" &&
    existingUser.accessStatus === "APPROVED" &&
    existingUser.canManageUsers &&
    !willKeepManageUsers
  ) {
    const otherManagersCount = await db.user.count({
      where: {
        id: { not: existingUser.id },
        role: "ADMIN",
        accessStatus: "APPROVED",
        canManageUsers: true,
      },
    });

    if (otherManagersCount === 0) {
      return NextResponse.json(
        {
          error:
            "É necessário manter ao menos um administrador com acesso ao controle de usuários.",
        },
        { status: 400 },
      );
    }
  }

  const user = await db.user.update({
    where: { id: existingUser.id },
    data: {
      accessStatus: status,
      reviewedAt: new Date(),
      role,
      ...nextPermissions,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accessStatus: true,
      createdAt: true,
      canManageComplementar: true,
      canManageExtensao: true,
      canManageUsers: true,
    },
  });

  return NextResponse.json(
    {
      user: {
        ...user,
        permissions: toAdminPermissions(user),
      },
    },
    { status: 200 },
  );
}
