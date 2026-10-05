import { db } from "@/lib/db";
import { getDriveClient } from "@/lib/drive";
import { enqueueCertificate } from "@/lib/queue";
import { extensionCertificateUploadSchema } from "@/lib/schemas/extension.schema";
import { validateFormData } from "@/lib/validators/validate-form-data";
import { validateRouteParams } from "@/lib/validators/validate-request";
import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getExtensionHoursLimit,
  getExtensionUsedHours,
  requireStudentSession,
  toProjectPayload,
  uploadExtensionCertificateFile,
} from "../../_shared";

const routeParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStudentSession(request);
  if (auth instanceof Response) return auth;
  const { session } = auth;

  const params = await context.params;
  const validatedParams = validateRouteParams(params, routeParamsSchema);
  if (validatedParams instanceof Response) return validatedParams;

  const project = await db.extensionProject.findUnique({
    where: { id: validatedParams.id },
    include: { certificate: true },
  });

  if (!project || project.userId !== session.sub) {
    return NextResponse.json(
      { error: "Projeto de extensão não encontrado." },
      { status: 404 },
    );
  }

  if (project.status !== "ACTIVE") {
    return NextResponse.json(
      {
        error:
          "O certificado só pode ser enviado depois que a proposta for aprovada.",
      },
      { status: 409 },
    );
  }

  if (project.certificate && project.certificate.status !== "REJECTED") {
    return NextResponse.json(
      {
        error:
          "Já existe um certificado enviado para este projeto aguardando ou já avaliado.",
      },
      { status: 409 },
    );
  }

  const form = await request.formData();
  const validationResult = validateFormData(
    form,
    extensionCertificateUploadSchema,
  );
  if (!validationResult.success) {
    return NextResponse.json(
      { error: validationResult.error, issues: validationResult.issues },
      { status: 422 },
    );
  }

  const hoursLimit = await getExtensionHoursLimit();
  const usedHours = await getExtensionUsedHours(session.sub);

  if (usedHours >= hoursLimit) {
    return NextResponse.json(
      { error: `Limite de ${hoursLimit}h para extensão já foi atingido.` },
      { status: 400 },
    );
  }

  const drive = await getDriveClient();
  const { fileUrl, fileId } = await uploadExtensionCertificateFile(
    drive,
    session,
    validationResult.data.file,
  );

  const existingCertificateId = project.certificate?.id;

  const certificate = existingCertificateId
    ? await db.certificate.update({
        where: { id: existingCertificateId },
        data: {
          fileUrl,
          fileId,
          status: "PENDING",
          feedback: null,
          hours: null,
        },
      })
    : await db.certificate.create({
        data: {
          title: project.title,
          certificatetype: "EXTENSAO",
          fileUrl,
          fileId,
          status: "PENDING",
          userId: session.sub,
          extensionProjectId: project.id,
        } satisfies Prisma.CertificateUncheckedCreateInput,
      });

  const enfileiradoComSucesso = await enqueueCertificate(certificate.id);
  if (!enfileiradoComSucesso) {
    console.error(
      `[Queue Error] Falha ao enfileirar certificado de extensão ${certificate.id}.`,
    );
    await db.certificate.update({
      where: { id: certificate.id },
      data: {
        aiStatus: "FAILED",
        aiFeedback:
          "Erro temporário no servidor de mensageria. A análise automática foi abortada.",
      },
    });
  }

  const updatedProject = await db.extensionProject.findUnique({
    where: { id: project.id },
    include: { certificate: true },
  });

  return NextResponse.json(
    { project: toProjectPayload(updatedProject!) },
    { status: 201 },
  );
}
