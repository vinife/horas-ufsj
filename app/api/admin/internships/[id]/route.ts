import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";
import { studentStatusUpdateEmail } from "@/lib/email/templates";
import { reviewInternshipSubmissionSchema } from "@/lib/schemas/internship.schema";
import {
  validateJsonRequest,
  validateRouteParams,
} from "@/lib/validators/validate-request";
import type { InternshipStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternshipAdmin, toAdminInternshipRow } from "../_shared";

const routeParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireInternshipAdmin(request);
  if (auth instanceof Response) return auth;

  const params = await context.params;
  const validatedParams = validateRouteParams(params, routeParamsSchema);
  if (validatedParams instanceof Response) return validatedParams;

  const body = await validateJsonRequest(
    request,
    reviewInternshipSubmissionSchema,
  );
  if (body instanceof Response) return body;

  const submission = await db.internshipSubmission.findUnique({
    where: { id: validatedParams.id },
    include: { internship: true },
  });

  if (!submission) {
    return NextResponse.json(
      { error: "Submissão não encontrada." },
      { status: 404 },
    );
  }

  const internship = submission.internship;
  const commentary = body.commentary?.trim() || null;

  if (body.decision === "allow") {
    const nextInternshipStart =
      submission.kind === "INITIAL" ? submission.start : internship.start;

    await db.$transaction([
      db.internshipSubmission.update({
        where: { id: submission.id },
        data: { status: "APPROVED", reviewedAt: new Date(), feedback: null },
      }),
      db.internship.update({
        where: { id: internship.id },
        data: {
          status: "ACTIVE",
          company: submission.company,
          supervisor: submission.supervisor,
          start: nextInternshipStart,
          end: submission.end,
          feedback: null,
        },
      }),
    ]);
  } else {
    const nextInternshipStatus: InternshipStatus =
      submission.kind === "INITIAL" ? "REJECTED" : "ACTIVE";

    await db.$transaction([
      db.internshipSubmission.update({
        where: { id: submission.id },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
          feedback: commentary,
        },
      }),
      db.internship.update({
        where: { id: internship.id },
        data: {
          status: nextInternshipStatus,
          feedback: commentary,
        },
      }),
    ]);
  }

  const updated = await db.internship.findUnique({
    where: { id: internship.id },
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
    const kindLabel = submission.kind === "EXTENSION" ? "Aditivo" : "Período inicial";
    const { subject, html } = studentStatusUpdateEmail({
      studentName: updated.user.name ?? "aluno(a)",
      itemLabel: "Estágio",
      statusHeadline:
        body.decision === "allow" ? `${kindLabel} aprovado` : `${kindLabel} rejeitado`,
      message:
        body.decision === "allow"
          ? `Seu ${kindLabel.toLowerCase()} de estágio foi aprovado.`
          : `Seu ${kindLabel.toLowerCase()} de estágio foi rejeitado. Motivo: ${commentary ?? "não informado"}.`,
    });
    await enqueueEmail({ to: updated.user.email, subject, html });
  }

  return NextResponse.json(
    { internship: toAdminInternshipRow(updated) },
    { status: 200 },
  );
}
