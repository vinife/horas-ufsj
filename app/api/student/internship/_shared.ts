import { db } from "@/lib/db";
import {
  ensureChildFolder,
  ensureStudentFolder,
  getDriveClient,
  getDriveFileIdFromUrl,
  getErrorMessage,
  removeFileFromDrive,
} from "@/lib/drive";
import { internshipFormDataSchema } from "@/lib/schemas/internship.schema";
import { getSession, type SessionPayload } from "@/lib/session";
import { validateFormData } from "@/lib/validators/validate-form-data";
import type {
  Internship,
  InternshipSubmission,
  Prisma,
} from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";

const INTERNSHIP_DRIVE_FOLDER = "Estagio";

export type InternshipSubmissionPayload = {
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

export type InternshipPayload = {
  id: string;
  status: "PENDING" | "REJECTED" | "ACTIVE" | "COMPLETED" | "TERMINATED";
  company: string;
  supervisor: string;
  start: string;
  end: string;
  feedback: string | null;
  submissions: InternshipSubmissionPayload[];
};

function toSubmissionPayload(
  submission: InternshipSubmission,
): InternshipSubmissionPayload {
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

export function toInternshipPayload(
  internship: Internship & { submissions: InternshipSubmission[] },
): InternshipPayload {
  return {
    id: internship.id,
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

export async function requireStudentSession(
  request: NextRequest,
): Promise<{ session: SessionPayload } | Response> {
  const sessionId = request.cookies.get("session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { session };
}

async function uploadInternshipFile(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  session: SessionPayload,
  file: File,
) {
  const folderName =
    session.name ?? session.email?.split("@")[0] ?? session.sub;
  const studentFolder = await ensureStudentFolder(drive, folderName);
  const typeFolder = await ensureChildFolder(
    drive,
    studentFolder,
    INTERNSHIP_DRIVE_FOLDER,
  );

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const stream = Readable.from(buffer);

  const uploaded = await drive.files.create({
    requestBody: {
      name: file.name,
      parents: [typeFolder.id],
    },
    media: {
      mimeType: file.type || "application/octet-stream",
      body: stream,
    },
    supportsAllDrives: true,
    fields: "id, webViewLink",
  });

  // Não tentamos mais tornar o arquivo público ("anyone with the link") —
  // a política do Workspace institucional da UFSJ bloqueia isso em Shared
  // Drives. O arquivo é servido via
  // app/api/files/internship-submission/[id]/route.ts, que baixa os bytes
  // usando a conta de serviço (que já tem acesso garantido) e aplica o
  // próprio controle de acesso da aplicação.

  return {
    fileUrl: uploaded.data.webViewLink ?? "",
    fileId: uploaded.data.id ?? "",
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireStudentSession(request);
  if (auth instanceof Response) return auth;
  const { session } = auth;

  const internship = await db.internship.findFirst({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    include: { submissions: true },
  });

  return NextResponse.json(
    { internship: internship ? toInternshipPayload(internship) : null },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireStudentSession(request);
  if (auth instanceof Response) return auth;
  const { session } = auth;

  const existing = await db.internship.findFirst({
    where: {
      userId: session.sub,
      status: { notIn: ["COMPLETED", "TERMINATED"] },
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      {
        error:
          "Você já possui um estágio em andamento ou aguardando revisão.",
      },
      { status: 409 },
    );
  }

  const form = await request.formData();
  const validationResult = validateFormData(form, internshipFormDataSchema);
  if (!validationResult.success) {
    return NextResponse.json(
      { error: validationResult.error, issues: validationResult.issues },
      { status: 422 },
    );
  }

  const { file, company, supervisor, start, end } = validationResult.data;

  const drive = await getDriveClient();
  const { fileUrl, fileId } = await uploadInternshipFile(
    drive,
    session,
    file,
  );

  const created = await db.$transaction(async (tx) => {
    const internship = await tx.internship.create({
      data: {
        userId: session.sub,
        status: "PENDING",
        company,
        supervisor,
        start,
        end,
      } satisfies Prisma.InternshipUncheckedCreateInput,
    });

    const submission = await tx.internshipSubmission.create({
      data: {
        internshipId: internship.id,
        kind: "INITIAL",
        company,
        supervisor,
        start,
        end,
        fileUrl,
        fileId,
        status: "PENDING",
      } satisfies Prisma.InternshipSubmissionUncheckedCreateInput,
    });

    return { ...internship, submissions: [submission] };
  });

  return NextResponse.json(
    { internship: toInternshipPayload(created) },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireStudentSession(request);
  if (auth instanceof Response) return auth;
  const { session } = auth;

  const internship = await db.internship.findFirst({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    include: { submissions: { orderBy: { createdAt: "desc" } } },
  });

  if (!internship) {
    return NextResponse.json(
      { error: "Estágio não encontrado." },
      { status: 404 },
    );
  }

  if (internship.status === "COMPLETED" || internship.status === "TERMINATED") {
    return NextResponse.json(
      {
        error:
          "Este estágio já foi finalizado e não pode ser editado.",
      },
      { status: 409 },
    );
  }

  const form = await request.formData();
  const validationResult = validateFormData(form, internshipFormDataSchema);
  if (!validationResult.success) {
    return NextResponse.json(
      { error: validationResult.error, issues: validationResult.issues },
      { status: 422 },
    );
  }

  const { file, company, supervisor, start, end } = validationResult.data;
  const drive = await getDriveClient();

  if (internship.status === "ACTIVE") {
    const { fileUrl, fileId } = await uploadInternshipFile(
      drive,
      session,
      file,
    );

    const updated = await db.$transaction(async (tx) => {
      await tx.internshipSubmission.create({
        data: {
          internshipId: internship.id,
          kind: "EXTENSION",
          company,
          supervisor,
          start,
          end,
          fileUrl,
          fileId,
          status: "PENDING",
        } satisfies Prisma.InternshipSubmissionUncheckedCreateInput,
      });

      return tx.internship.update({
        where: { id: internship.id },
        data: { status: "PENDING", feedback: null },
        include: { submissions: true },
      });
    });

    return NextResponse.json(
      { internship: toInternshipPayload(updated) },
      { status: 200 },
    );
  }

  // status is PENDING or REJECTED: update the INITIAL submission in place.
  const initialSubmission = internship.submissions.find(
    (submission) => submission.kind === "INITIAL",
  );

  if (!initialSubmission) {
    console.error(
      `[Internship] Submissão INITIAL não encontrada para o estágio ${internship.id}.`,
    );
    return NextResponse.json(
      { error: "Não foi possível localizar a submissão original." },
      { status: 500 },
    );
  }

  const oldDriveFileId =
    initialSubmission.fileId ||
    getDriveFileIdFromUrl(initialSubmission.fileUrl);

  if (oldDriveFileId) {
    try {
      await removeFileFromDrive(drive, oldDriveFileId);
    } catch (error) {
      return NextResponse.json(
        {
          error: `Não foi possível remover o arquivo anterior do Google Drive: ${getErrorMessage(error)}`,
        },
        { status: 500 },
      );
    }
  }

  const { fileUrl, fileId } = await uploadInternshipFile(
    drive,
    session,
    file,
  );

  const updated = await db.$transaction(async (tx) => {
    await tx.internshipSubmission.update({
      where: { id: initialSubmission.id },
      data: {
        company,
        supervisor,
        start,
        end,
        fileUrl,
        fileId,
        status: "PENDING",
        feedback: null,
        reviewedAt: null,
      },
    });

    return tx.internship.update({
      where: { id: internship.id },
      data: {
        company,
        supervisor,
        start,
        end,
        status: "PENDING",
        feedback: null,
      },
      include: { submissions: true },
    });
  });

  return NextResponse.json(
    { internship: toInternshipPayload(updated) },
    { status: 200 },
  );
}
