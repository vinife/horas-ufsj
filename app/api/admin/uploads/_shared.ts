import { db } from "@/lib/db";
import {
  reviewCertificateSchema,
  uploadSearchQuerySchema,
} from "@/lib/schemas/upload.schema";
import { getSession } from "@/lib/session";
import {
  validateJsonRequest,
  validateQueryParams,
  validateRouteParams,
} from "@/lib/validators/validate-request";
import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

type UploadType = "complementar" | "extensao";

type SortBy = "deadline" | "name" | "email";
type SortDir = "asc" | "desc";
type StatusFilter = "pending" | "reviewed" | "all";

const CERTIFICATE_REVIEW_DEADLINE_DAYS = 15;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function hasUploadPermission(
  admin: {
    canManageComplementar: boolean;
    canManageExtensao: boolean;
  },
  uploadType: UploadType,
) {
  return uploadType === "complementar"
    ? admin.canManageComplementar
    : admin.canManageExtensao;
}

function toCertificateType(uploadType: UploadType) {
  return uploadType === "extensao" ? "EXTENSAO" : "COMPLEMENTAR";
}

const reviewRouteParamsSchema = z.object({
  id: z.string().trim().min(1),
});

function toDisplayStatus(status: "PENDING" | "APPROVED" | "REJECTED") {
  if (status === "APPROVED") return "APROVADO";
  if (status === "REJECTED") return "REJEITADO";
  return "PENDENTE";
}

function calculateDeadline(createdAt: Date, nowMs: number) {
  const createdAtMs = createdAt.getTime();
  const elapsedDays = Math.floor((nowMs - createdAtMs) / DAY_IN_MS);
  const daysRemaining = CERTIFICATE_REVIEW_DEADLINE_DAYS - elapsedDays;
  const deadlineDate = new Date(
    createdAtMs + CERTIFICATE_REVIEW_DEADLINE_DAYS * DAY_IN_MS,
  );

  return {
    deadlineDate: deadlineDate.toISOString(),
    daysRemaining,
    isOverdue: daysRemaining < 0,
  };
}

function compareStrings(a: string | null, b: string | null, dir: SortDir) {
  const left = (a ?? "").toLocaleLowerCase("pt-BR");
  const right = (b ?? "").toLocaleLowerCase("pt-BR");
  const comparison = left.localeCompare(right, "pt-BR");

  return dir === "asc" ? comparison : -comparison;
}

function compareDates(a: Date, b: Date, dir: SortDir) {
  const comparison = a.getTime() - b.getTime();
  return dir === "asc" ? comparison : -comparison;
}

function compareUsersForDeadline(
  a: { id: string; name: string | null; email: string },
  b: { id: string; name: string | null; email: string },
  pendingByUserId: Map<string, Date>,
  dir: SortDir,
) {
  const aPending = pendingByUserId.get(a.id);
  const bPending = pendingByUserId.get(b.id);
  const aHasPending = Boolean(aPending);
  const bHasPending = Boolean(bPending);

  // Always keep students with pending certificates before reviewed students.
  if (aHasPending !== bHasPending) {
    return aHasPending ? -1 : 1;
  }

  if (aPending && bPending) {
    const deadlineComparison = compareDates(aPending, bPending, dir);
    if (deadlineComparison !== 0) {
      return deadlineComparison;
    }
  }

  const nameComparison = compareStrings(a.name, b.name, dir);
  if (nameComparison !== 0) {
    return nameComparison;
  }

  return compareStrings(a.email, b.email, dir);
}

export function createAdminUploadGetHandler(uploadType: UploadType) {
  return async function GET(request: NextRequest) {
    const sessionId = request.cookies.get("session")?.value;
    if (!sessionId) {
      return NextResponse.json({ files: [] }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session || session.role !== "admin") {
      return NextResponse.json({ files: [] }, { status: 403 });
    }

    const adminUser = await db.user.findUnique({
      where: { id: session.sub },
      select: {
        role: true,
        accessStatus: true,
        canManageComplementar: true,
        canManageExtensao: true,
      },
    });

    if (
      !adminUser ||
      adminUser.role !== "ADMIN" ||
      adminUser.accessStatus !== "APPROVED" ||
      !hasUploadPermission(adminUser, uploadType)
    ) {
      return NextResponse.json({ files: [] }, { status: 403 });
    }

    const query = validateQueryParams(
      request.nextUrl.searchParams,
      uploadSearchQuerySchema,
    );
    if (query instanceof Response) return query;

    const search = query.q.trim();
    const page = query.page;
    const pageSize = query.pageSize;
    const sortBy = query.sortBy as SortBy;
    const sortDir = query.sortDir as SortDir;
    const statusFilter = query.statusFilter as StatusFilter;
    const skip = (page - 1) * pageSize;
    const certificateType = toCertificateType(uploadType);

    let statusFilterWhere: Prisma.UserWhereInput = {
      certificados: {
        some: {
          certificatetype: certificateType,
        },
      },
    };

    if (statusFilter === "pending") {
      statusFilterWhere = {
        certificados: {
          some: {
            certificatetype: certificateType,
            status: "PENDING",
          },
        },
      };
    }

    if (statusFilter === "reviewed") {
      statusFilterWhere = {
        AND: [
          {
            certificados: {
              some: {
                certificatetype: certificateType,
              },
            },
          },
          {
            certificados: {
              none: {
                certificatetype: certificateType,
                status: "PENDING",
              },
            },
          },
        ],
      };
    }

    const userWhere: Prisma.UserWhereInput = {
      ...statusFilterWhere,
    };

    if (search) {
      userWhere.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        {
          certificados: {
            some: {
              certificatetype: certificateType,
              title: { contains: search, mode: "insensitive" },
            },
          },
        },
      ];
    }

    const users = await db.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const userIds = users.map((user) => user.id);
    const pendingDeadlines =
      userIds.length > 0
        ? await db.certificate.groupBy({
            by: ["userId"],
            where: {
              userId: { in: userIds },
              certificatetype: certificateType,
              status: "PENDING",
            },
            _min: {
              createdAt: true,
            },
          })
        : [];

    const pendingByUserId = new Map<string, Date>();
    for (const item of pendingDeadlines) {
      if (item._min.createdAt) {
        pendingByUserId.set(item.userId, item._min.createdAt);
      }
    }

    const sortedUsers = [...users].sort((a, b) => {
      if (sortBy === "name") {
        const nameComparison = compareStrings(a.name, b.name, sortDir);
        if (nameComparison !== 0) {
          return nameComparison;
        }
        return compareStrings(a.email, b.email, sortDir);
      }

      if (sortBy === "email") {
        const emailComparison = compareStrings(a.email, b.email, sortDir);
        if (emailComparison !== 0) {
          return emailComparison;
        }
        return compareStrings(a.name, b.name, sortDir);
      }

      return compareUsersForDeadline(a, b, pendingByUserId, sortDir);
    });

    const totalCount = sortedUsers.length;
    const pagedUserIds = sortedUsers
      .slice(skip, skip + pageSize)
      .map((user) => user.id);

    const students = await db.user.findMany({
      where: {
        id: { in: pagedUserIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
        certificados: {
          where: {
            certificatetype: certificateType,
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            hours: true,
            status: true,
            feedback: true,
            fileUrl: true,
            createdAt: true,
            aiStatus: true,
            aiDecision: true,
            aiSuggestedTitle: true,
            aiSuggestedHours: true,
            aiFeedback: true,
          },
        },
      },
    });

    const studentsById = new Map(
      students.map((student) => [student.id, student]),
    );
    const nowMs = Date.now();
    const orderedStudents = pagedUserIds
      .map((id) => studentsById.get(id))
      .filter((student): student is NonNullable<typeof student> =>
        Boolean(student),
      );

    return NextResponse.json(
      {
        students: orderedStudents.map((student) => {
          const pendingDeadlinesForStudent = student.certificados
            .filter((file) => file.status === "PENDING")
            .map((file) => file.createdAt)
            .sort((a, b) => a.getTime() - b.getTime());

          const oldestPending = pendingDeadlinesForStudent[0];
          const studentDeadline = oldestPending
            ? {
                hasPending: true as const,
                ...calculateDeadline(oldestPending, nowMs),
              }
            : {
                hasPending: false as const,
              };

          return {
            id: student.id,
            name: student.name,
            email: student.email,
            status: oldestPending ? "PENDENTE" : "APROVADO",
            deadline: studentDeadline,
            files: student.certificados.map((file) => ({
              id: file.id,
              title: file.title,
              hours: file.hours ?? 0,
              status: toDisplayStatus(file.status),
              feedback: file.feedback,
              fileUrl: file.fileUrl,
              createdAt: file.createdAt,
              deadline:
                file.status === "PENDING"
                  ? calculateDeadline(file.createdAt, nowMs)
                  : null,
              aiStatus: file.aiStatus,
              aiDecision: file.aiDecision,
              aiSuggestedTitle: file.aiSuggestedTitle,
              aiSuggestedHours: file.aiSuggestedHours,
              aiFeedback: file.aiFeedback,
            })),
          };
        }),
        meta: {
          totalItems: totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          currentPage: page,
          pageSize: pageSize,
        },
      },
      { status: 200 },
    );
  };
}

export function createAdminUploadPatchHandler(uploadType: UploadType) {
  return async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) {
    const sessionId = request.cookies.get("session")?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminUser = await db.user.findUnique({
      where: { id: session.sub },
      select: {
        role: true,
        accessStatus: true,
        canManageComplementar: true,
        canManageExtensao: true,
      },
    });

    if (
      !adminUser ||
      adminUser.role !== "ADMIN" ||
      adminUser.accessStatus !== "APPROVED" ||
      !hasUploadPermission(adminUser, uploadType)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await context.params;
    const validatedParams = validateRouteParams(
      params,
      reviewRouteParamsSchema,
    );
    if (validatedParams instanceof Response) return validatedParams;

    const body = await validateJsonRequest(request, reviewCertificateSchema);
    if (body instanceof Response) return body;

    const certificateType = toCertificateType(uploadType);
    const current = await db.certificate.findFirst({
      where: {
        id: validatedParams.id,
        certificatetype: certificateType,
      },
      select: {
        id: true,
      },
    });

    if (!current) {
      return NextResponse.json(
        { error: "Certificado não encontrado." },
        { status: 404 },
      );
    }

    const nextStatus = body.decision === "allow" ? "APPROVED" : "REJECTED";
    const updated = await db.certificate.update({
      where: { id: current.id },
      data: {
        status: nextStatus,
        hours: body.hours,
        feedback:
          body.decision === "deny" ? (body.commentary?.trim() ?? null) : null,
      },
      select: {
        id: true,
        status: true,
        hours: true,
        feedback: true,
      },
    });

    return NextResponse.json({ certificate: updated }, { status: 200 });
  };
}
