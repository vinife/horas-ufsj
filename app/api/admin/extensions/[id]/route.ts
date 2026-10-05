import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";
import { studentStatusUpdateEmail } from "@/lib/email/templates";
import { reviewExtensionProjectSchema } from "@/lib/schemas/extension.schema";
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
} from "../_shared";

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

  const body = await validateJsonRequest(request, reviewExtensionProjectSchema);
  if (body instanceof Response) return body;

  const project = await db.extensionProject.findUnique({
    where: { id: validatedParams.id },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Projeto de extensão não encontrado." },
      { status: 404 },
    );
  }

  if (project.status !== "PENDING") {
    return NextResponse.json(
      { error: "Esta proposta já foi avaliada." },
      { status: 409 },
    );
  }

  const commentary = body.commentary?.trim() || null;

  const updated = await db.extensionProject.update({
    where: { id: project.id },
    data:
      body.decision === "allow"
        ? { status: "ACTIVE", feedback: null }
        : { status: "REJECTED", feedback: commentary },
    include: {
      user: { select: { name: true, email: true } },
      certificate: true,
    },
  });

  if (updated.user.email) {
    const { subject, html } = studentStatusUpdateEmail({
      studentName: updated.user.name ?? "aluno(a)",
      itemLabel: `Extensão: ${updated.title}`,
      statusHeadline:
        body.decision === "allow" ? "Proposta aprovada" : "Proposta rejeitada",
      message:
        body.decision === "allow"
          ? `Sua proposta de extensão "${updated.title}" foi aprovada. Você já pode enviar o certificado assinado.`
          : `Sua proposta de extensão "${updated.title}" foi rejeitada. Motivo: ${updated.feedback ?? "não informado"}.`,
    });
    await enqueueEmail({ to: updated.user.email, subject, html });
  }

  return NextResponse.json(
    { project: toAdminProjectPayload(updated) },
    { status: 200 },
  );
}
