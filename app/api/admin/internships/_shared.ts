import { db } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/session";
import type {
  Certificate,
  Internship,
  InternshipDocument,
  InternshipSubmission,
  User,
} from "@prisma/client";
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

export type AdminInternshipDocumentPayload = {
  id: string;
  kind:
    | "PARTIAL_REPORT"
    | "COMPLETION_TERM"
    | "FINAL_REPORT"
    | "TERMINATION_TERM";
  status: "PENDING" | "APPROVED" | "REJECTED";
  feedback: string | null;
  createdAt: string;
  reviewedAt: string | null;
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
  documents: AdminInternshipDocumentPayload[];
  certificate: { hours: number | null } | null;
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

function toDocumentPayload(
  document: InternshipDocument,
): AdminInternshipDocumentPayload {
  return {
    id: document.id,
    kind: document.kind,
    status: document.status,
    feedback: document.feedback,
    createdAt: document.createdAt.toISOString(),
    reviewedAt: document.reviewedAt?.toISOString() ?? null,
  };
}

export function toAdminInternshipRow(
  internship: Internship & {
    submissions: InternshipSubmission[];
    user: Pick<User, "name" | "email">;
    documents?: InternshipDocument[];
    certificate?: Certificate | null;
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
    documents: [...(internship.documents ?? [])]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(toDocumentPayload),
    certificate: internship.certificate
      ? { hours: internship.certificate.hours }
      : null,
  };
}

/**
 * Deterministically picks which file backs the synthetic hours Certificate:
 * prefer the most recently approved FINAL_REPORT, then the most recently
 * approved COMPLETION_TERM, falling back to the INITIAL submission's file
 * (always present and approved once the internship reached ACTIVE).
 */
export async function resolveInternshipHoursFile(
  internshipId: string,
): Promise<{ fileUrl: string; fileId: string }> {
  const finalReport = await db.internshipDocument.findFirst({
    where: { internshipId, kind: "FINAL_REPORT", status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    select: { fileUrl: true, fileId: true },
  });
  if (finalReport) return finalReport;

  const completionTerm = await db.internshipDocument.findFirst({
    where: { internshipId, kind: "COMPLETION_TERM", status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    select: { fileUrl: true, fileId: true },
  });
  if (completionTerm) return completionTerm;

  const initialSubmission = await db.internshipSubmission.findFirst({
    where: { internshipId, kind: "INITIAL" },
    select: { fileUrl: true, fileId: true },
  });
  if (initialSubmission) return initialSubmission;

  throw new Error(
    `Nenhum arquivo disponível para vincular ao certificado de horas do estágio ${internshipId}.`,
  );
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
