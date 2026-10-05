import { db } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/session";
import type { Internship, InternshipSubmission, User } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export type AdminInternshipSubmissionPayload = {
  id: string;
  kind: "INITIAL" | "EXTENSION";
  company: string;
  supervisor: string;
  start: string;
  end: string;
  fileUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  feedback: string | null;
  createdAt: string;
};

export type AdminInternshipRow = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  status: "PENDING" | "REJECTED" | "ACTIVE" | "COMPLETED" | "TERMINATED";
  company: string;
  supervisor: string;
  start: string;
  end: string;
  feedback: string | null;
  submissions: AdminInternshipSubmissionPayload[];
};

export async function requireInternshipAdmin(
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
      canManageEstagio: true,
    },
  });

  if (
    !adminUser ||
    adminUser.role !== "ADMIN" ||
    adminUser.accessStatus !== "APPROVED" ||
    !adminUser.canManageEstagio
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { session };
}

function toSubmissionPayload(
  submission: InternshipSubmission,
): AdminInternshipSubmissionPayload {
  return {
    id: submission.id,
    kind: submission.kind,
    company: submission.company,
    supervisor: submission.supervisor,
    start: submission.start.toISOString(),
    end: submission.end.toISOString(),
    fileUrl: submission.fileUrl,
    status: submission.status,
    feedback: submission.feedback,
    createdAt: submission.createdAt.toISOString(),
  };
}

export function toAdminInternshipRow(
  internship: Internship & {
    submissions: InternshipSubmission[];
    user: Pick<User, "name" | "email">;
  },
): AdminInternshipRow {
  return {
    id: internship.id,
    userId: internship.userId,
    name: internship.user.name,
    email: internship.user.email,
    status: internship.status,
    company: internship.company,
    supervisor: internship.supervisor,
    start: internship.start.toISOString(),
    end: internship.end.toISOString(),
    feedback: internship.feedback,
    submissions: [...internship.submissions]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(toSubmissionPayload),
  };
}

function compareStrings(a: string | null, b: string | null) {
  const left = (a ?? "").toLocaleLowerCase("pt-BR");
  const right = (b ?? "").toLocaleLowerCase("pt-BR");
  return left.localeCompare(right, "pt-BR");
}

const STATUS_TIER: Record<AdminInternshipRow["status"], number> = {
  PENDING: 0,
  ACTIVE: 1,
  REJECTED: 2,
  COMPLETED: 2,
  TERMINATED: 2,
};

/**
 * Orders internships so that PENDING items come first, then ACTIVE, then
 * everything else (REJECTED/COMPLETED/TERMINATED); within a tier, oldest
 * first, then student name (pt-BR locale).
 */
export function compareInternshipRows(
  a: { status: AdminInternshipRow["status"]; createdAt: Date; name: string | null },
  b: { status: AdminInternshipRow["status"]; createdAt: Date; name: string | null },
) {
  const tierComparison = STATUS_TIER[a.status] - STATUS_TIER[b.status];
  if (tierComparison !== 0) {
    return tierComparison;
  }

  const createdAtComparison = a.createdAt.getTime() - b.createdAt.getTime();
  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return compareStrings(a.name, b.name);
}
