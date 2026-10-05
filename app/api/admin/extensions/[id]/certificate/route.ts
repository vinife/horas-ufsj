import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";
import { studentStatusUpdateEmail } from "@/lib/email/templates";
import { reviewExtensionCertificateSchema } from "@/lib/schemas/extension.schema";
import {
  validateJsonRequest,
  validateRouteParams,
} from "@/lib/validators/validate-request";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireExtensionAdmin,
  toAdminProjectPayload,
} from "../../_shared";

const routeParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireExtensionAdmin(request);
  if (auth instanceof Response) return auth;

  const params = await context.params;
  const validatedParams = validateRouteParams(params, routeParamsSchema);
  if (validatedParams instanceof Response) return validatedParams;

  const body = await validateJsonRequest(
    request,
    reviewExtensionCertificateSchema,
  );
  if (body instanceof Response) return body;

  const project = await db.extensionProject.findUnique({
    where: { id: validatedParams.id },
    include: { certificate: true },
  });

  if (!project || !project.certificate) {
    return NextResponse.json(
      { error: "Certificado não encontrado." },
      { status: 404 },
    );
  }

  if (project.certificate.status !== "PENDING") {
    return NextResponse.json(
      { error: "Este certificado já foi avaliado." },
      { status: 409 },
    );
  }

  const commentary = body.commentary?.trim() || null;

  if (body.decision === "allow") {
    await db.$transaction([
      db.certificate.update({
        where: { id: project.certificate.id },
        data: { status: "APPROVED", hours: body.hours, feedback: null },
      }),
      db.extensionProject.update({
        where: { id: project.id },
        data: { status: "COMPLETED" },
      }),
    ]);
  } else {
    await db.certificate.update({
      where: { id: project.certificate.id },
      data: { status: "REJECTED", feedback: commentary },
    });
  }

  const updated = await db.extensionProject.findUnique({
    where: { id: project.id },
    include: {
      user: { select: { name: true, email: true } },
      certificate: true,
    },
  });

  if (updated?.user.email) {
    const { subject, html } = studentStatusUpdateEmail({
      studentName: updated.user.name ?? "aluno(a)",
      itemLabel: `Extensão: ${updated.title}`,
      statusHeadline:
        body.decision === "allow"
          ? "Certificado aprovado"
          : "Certificado rejeitado",
      message:
        body.decision === "allow"
          ? `O certificado de "${updated.title}" foi aprovado com ${body.hours}h concedidas.`
          : `O certificado de "${updated.title}" foi rejeitado. Motivo: ${updated.certificate?.feedback ?? "não informado"}.`,
    });
    await enqueueEmail({ to: updated.user.email, subject, html });
  }

  return NextResponse.json(
    { project: toAdminProjectPayload(updated!) },
    { status: 200 },
  );
}
