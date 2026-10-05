import { db } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/session";
import type { Certificate, ExtensionProject, User } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export type AdminExtensionCertificatePayload = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  hours: number | null;
  feedback: string | null;
  createdAt: string;
};

export type AdminExtensionProjectPayload = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  title: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coordinatorInstitution: string;
  workPlan: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "COMPLETED";
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
  certificate: AdminExtensionCertificatePayload | null;
};

export type AdminExtensionStudentRow = {
  userId: string;
  name: string | null;
  email: string;
  projects: AdminExtensionProjectPayload[];
};

export async function requireExtensionAdmin(
  request: NextRequest,
): Promise<{ session: SessionPayload } | Response> {
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
      canManageExtensao: true,
    },
  });

  if (
    !adminUser ||
    adminUser.role !== "ADMIN" ||
    adminUser.accessStatus !== "APPROVED" ||
    !adminUser.canManageExtensao
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { session };
}

function toCertificatePayload(
  certificate: Certificate,
): AdminExtensionCertificatePayload {
  return {
    id: certificate.id,
    status: certificate.status,
    hours: certificate.hours,
    feedback: certificate.feedback,
    createdAt: certificate.createdAt.toISOString(),
  };
}

export function toAdminProjectPayload(
  project: ExtensionProject & {
    user: Pick<User, "name" | "email">;
    certificate?: Certificate | null;
  },
): AdminExtensionProjectPayload {
  return {
    id: project.id,
    userId: project.userId,
    name: project.user.name,
    email: project.user.email,
    title: project.title,
    coordinatorName: project.coordinatorName,
    coordinatorEmail: project.coordinatorEmail,
    coordinatorInstitution: project.coordinatorInstitution,
    workPlan: project.workPlan,
    status: project.status,
    feedback: project.feedback,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    certificate: project.certificate
      ? toCertificatePayload(project.certificate)
      : null,
  };
}

function compareStrings(a: string | null, b: string | null) {
  const left = (a ?? "").toLocaleLowerCase("pt-BR");
  const right = (b ?? "").toLocaleLowerCase("pt-BR");
  return left.localeCompare(right, "pt-BR");
}

const STATUS_TIER: Record<AdminExtensionProjectPayload["status"], number> = {
  PENDING: 0,
  ACTIVE: 1,
  REJECTED: 2,
  COMPLETED: 2,
};

/**
 * Groups projects by student, sorted so students with any PENDING or
 * certificate-pending project come first, then by the oldest project's
 * creation date, then by student name (pt-BR locale). Within a student's
 * row, their own projects are sorted the same way.
 */
export function groupAndSortByStudent(
  projects: AdminExtensionProjectPayload[],
): AdminExtensionStudentRow[] {
  const byUser = new Map<string, AdminExtensionStudentRow>();

  for (const project of projects) {
    const existing = byUser.get(project.userId);
    if (existing) {
      existing.projects.push(project);
    } else {
      byUser.set(project.userId, {
        userId: project.userId,
        name: project.name,
        email: project.email,
        projects: [project],
      });
    }
  }

  const projectTier = (project: AdminExtensionProjectPayload) =>
    project.status === "ACTIVE" && project.certificate?.status === "PENDING"
      ? 0
      : STATUS_TIER[project.status];

  const rows = [...byUser.values()];
  for (const row of rows) {
    row.projects.sort((a, b) => {
      const tierComparison = projectTier(a) - projectTier(b);
      if (tierComparison !== 0) return tierComparison;
      return (
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }

  rows.sort((a, b) => {
    const tierComparison =
      projectTier(a.projects[0]) - projectTier(b.projects[0]);
    if (tierComparison !== 0) return tierComparison;
    return compareStrings(a.name, b.name);
  });

  return rows;
}
