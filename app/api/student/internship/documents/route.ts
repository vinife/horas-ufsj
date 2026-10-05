import { db } from "@/lib/db";
import { getDriveClient } from "@/lib/drive";
import { internshipDocumentUploadSchema } from "@/lib/schemas/internship-document.schema";
import { validateFormData } from "@/lib/validators/validate-form-data";
import type { InternshipDocumentKind, InternshipStatus, Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  requireStudentSession,
  toDocumentPayload,
  uploadInternshipFile,
} from "../_shared";

const ELIGIBLE_STATUSES: Record<InternshipDocumentKind, InternshipStatus[]> = {
  PARTIAL_REPORT: ["ACTIVE"],
  COMPLETION_TERM: ["COMPLETED", "TERMINATED"],
  FINAL_REPORT: ["COMPLETED", "TERMINATED"],
  TERMINATION_TERM: ["TERMINATED"],
};

export async function POST(request: NextRequest) {
  const auth = await requireStudentSession(request);
  if (auth instanceof Response) return auth;
  const { session } = auth;

  const internship = await db.internship.findFirst({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });

  if (!internship) {
    return NextResponse.json(
      { error: "Estágio não encontrado." },
      { status: 404 },
    );
  }

  const form = await request.formData();
  const validationResult = validateFormData(
    form,
    internshipDocumentUploadSchema,
  );
  if (!validationResult.success) {
    return NextResponse.json(
      { error: validationResult.error, issues: validationResult.issues },
      { status: 422 },
    );
  }

  const { kind, file } = validationResult.data;

  if (!ELIGIBLE_STATUSES[kind].includes(internship.status)) {
    return NextResponse.json(
      {
        error:
          "Este documento não pode ser enviado no status atual do estágio.",
      },
      { status: 409 },
    );
  }

  const drive = await getDriveClient();
  const { fileUrl, fileId } = await uploadInternshipFile(drive, session, file);

  const created = await db.internshipDocument.create({
    data: {
      internshipId: internship.id,
      kind,
      fileUrl,
      fileId,
      status: "PENDING",
    } satisfies Prisma.InternshipDocumentUncheckedCreateInput,
  });

  return NextResponse.json(
    { document: toDocumentPayload(created) },
    { status: 201 },
  );
}
