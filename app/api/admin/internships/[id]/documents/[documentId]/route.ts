import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";
import { studentStatusUpdateEmail } from "@/lib/email/templates";
import { reviewInternshipDocumentSchema } from "@/lib/schemas/internship-document.schema";
import type { InternshipDocumentKind } from "@prisma/client";
import {
  validateJsonRequest,
  validateRouteParams,
} from "@/lib/validators/validate-request";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternshipAdmin, toAdminInternshipRow } from "../../../_shared";

const routeParamsSchema = z.object({
  id: z.string().trim().min(1),
  documentId: z.string().trim().min(1),
});

const DOCUMENT_KIND_LABELS: Record<InternshipDocumentKind, string> = {
  PARTIAL_REPORT: "Relatório parcial",
  COMPLETION_TERM: "Termo de Realização do Estágio",
  FINAL_REPORT: "Relatório final",
  TERMINATION_TERM: "Termo de Rescisão",
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  const auth = await requireInternshipAdmin(request);
  if (auth instanceof Response) return auth;

  const params = await context.params;
  const validatedParams = validateRouteParams(params, routeParamsSchema);
  if (validatedParams instanceof Response) return validatedParams;

  const body = await validateJsonRequest(
    request,
    reviewInternshipDocumentSchema,
  );
  if (body instanceof Response) return body;

  const document = await db.internshipDocument.findUnique({
    where: { id: validatedParams.documentId },
  });

  if (!document || document.internshipId !== validatedParams.id) {
    return NextResponse.json(
      { error: "Documento não encontrado." },
      { status: 404 },
    );
  }

  const commentary = body.commentary?.trim() || null;

  await db.internshipDocument.update({
    where: { id: document.id },
    data:
      body.decision === "allow"
        ? { status: "APPROVED", reviewedAt: new Date(), feedback: null }
        : { status: "REJECTED", reviewedAt: new Date(), feedback: commentary },
  });

  const updated = await db.internship.findUnique({
    where: { id: validatedParams.id },
    include: {
      user: { select: { name: true, email: true } },
      submissions: true,
      documents: true,
      certificate: true,
    },
  });

  if (!updated) {
    return NextResponse.json(
      { error: "Estágio não encontrado." },
      { status: 404 },
    );
  }

  if (updated.user.email) {
    const kindLabel = DOCUMENT_KIND_LABELS[document.kind];
    const { subject, html } = studentStatusUpdateEmail({
      studentName: updated.user.name ?? "aluno(a)",
      itemLabel: "Estágio",
      statusHeadline:
        body.decision === "allow" ? `${kindLabel} aprovado` : `${kindLabel} rejeitado`,
      message:
        body.decision === "allow"
          ? `Seu ${kindLabel.toLowerCase()} foi aprovado.`
          : `Seu ${kindLabel.toLowerCase()} foi rejeitado. Motivo: ${commentary ?? "não informado"}.`,
    });
    await enqueueEmail({ to: updated.user.email, subject, html });
  }

  return NextResponse.json(
    { internship: toAdminInternshipRow(updated) },
    { status: 200 },
  );
}
