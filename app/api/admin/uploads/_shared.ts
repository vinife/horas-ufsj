import {
  COMPLEMENTAR_HOUR_TYPE_CAPS,
  COMPLEMENTAR_HOUR_TYPE_LABELS,
} from "@/lib/constants/complementar-hour-types";
import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";
import { studentStatusUpdateEmail } from "@/lib/email/templates";
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
import type { CertificateType, Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

type UploadType = "complementar";

type SortBy = "deadline" | "name" | "email";
type SortDir = "asc" | "desc";
type StatusFilter = "pending" | "reviewed" | "all";

const CERTIFICATE_REVIEW_DEADLINE_DAYS = 15;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function hasUploadPermission(admin: { canManageComplementar: boolean }) {
  return admin.canManageComplementar;
}

function toCertificateType(): CertificateType {
  return "COMPLEMENTAR";
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

export function createAdminUploadGetHandler() {
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
      },
    });

    if (
      !adminUser ||
      adminUser.role !== "ADMIN" ||
      adminUser.accessStatus !== "APPROVED" ||
      !hasUploadPermission(adminUser)
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
    const certificateType = toCertificateType();

    let statusFilterWhere: Prisma.UserWhereInput = {
      certificados: {
        some: {
          certificatetype: certificateType,
          internshipId: null,
        },
      },
    };

    if (statusFilter === "pending") {
      statusFilterWhere = {
        certificados: {
          some: {
            certificatetype: certificateType,
            internshipId: null,
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
                internshipId: null,
              },
            },
          },
          {
            certificados: {
              none: {
                certificatetype: certificateType,
                internshipId: null,
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
              internshipId: null,
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
              internshipId: null,
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
            internshipId: null,
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
            complementarHourType: true,
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
              complementarHourType: file.complementarHourType,
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
      },
    });

    if (
      !adminUser ||
      adminUser.role !== "ADMIN" ||
      adminUser.accessStatus !== "APPROVED" ||
      !hasUploadPermission(adminUser)
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

    const certificateType = toCertificateType();
    const current = await db.certificate.findFirst({
      where: {
        id: validatedParams.id,
        certificatetype: certificateType,
        internshipId: null,
      },
      select: {
        id: true,
        userId: true,
        title: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!current) {
      return NextResponse.json(
        { error: "Certificado não encontrado." },
        { status: 404 },
      );
    }

    const nextStatus = body.decision === "allow" ? "APPROVED" : "REJECTED";

    if (uploadType === "complementar" && body.decision === "allow") {
      if (!body.complementarHourType) {
        return NextResponse.json(
          {
            error: "Selecione o tipo de horas para aprovar este certificado.",
          },
          { status: 422 },
        );
      }

      const cap = COMPLEMENTAR_HOUR_TYPE_CAPS[body.complementarHourType];
      if (cap !== null) {
        const usage = await db.certificate.aggregate({
          where: {
            userId: current.userId,
            certificatetype: "COMPLEMENTAR",
            complementarHourType: body.complementarHourType,
            status: "APPROVED",
          },
          _sum: { hours: true },
        });
        const usedHours = usage._sum.hours ?? 0;

        if (usedHours + body.hours > cap) {
          return NextResponse.json(
            {
              error: `Limite de ${cap}h para "${COMPLEMENTAR_HOUR_TYPE_LABELS[body.complementarHourType]}" seria excedido (já aprovadas: ${usedHours}h).`,
            },
            { status: 422 },
          );
        }
      }
    }

    const updated = await db.certificate.update({
      where: { id: current.id },
      data: {
        status: nextStatus,
        hours: body.hours,
        feedback:
          body.decision === "deny" ? (body.commentary?.trim() ?? null) : null,
        ...(uploadType === "complementar" && body.decision === "allow"
          ? { complementarHourType: body.complementarHourType }
          : {}),
      },
      select: {
        id: true,
        status: true,
        hours: true,
        feedback: true,
        complementarHourType: true,
      },
    });

    if (current.user.email) {
      const { subject, html } = studentStatusUpdateEmail({
        studentName: current.user.name ?? "aluno(a)",
        itemLabel: `Complementar: ${current.title}`,
        statusHeadline:
          body.decision === "allow" ? "Certificado aprovado" : "Certificado rejeitado",
        message:
          body.decision === "allow"
            ? `Seu certificado "${current.title}" foi aprovado com ${body.hours}h.`
            : `Seu certificado "${current.title}" foi rejeitado. Motivo: ${updated.feedback ?? "não informado"}.`,
      });
      await enqueueEmail({ to: current.user.email, subject, html });
    }

    return NextResponse.json({ certificate: updated }, { status: 200 });
  };
}
