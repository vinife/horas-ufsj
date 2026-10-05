import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";
import { studentStatusUpdateEmail } from "@/lib/email/templates";
import { setInternshipHoursSchema } from "@/lib/schemas/internship-document.schema";
import {
  validateJsonRequest,
  validateRouteParams,
} from "@/lib/validators/validate-request";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireInternshipAdmin,
  resolveInternshipHoursFile,
  toAdminInternshipRow,
} from "../../_shared";

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

  const body = await validateJsonRequest(request, setInternshipHoursSchema);
  if (body instanceof Response) return body;

  const internship = await db.internship.findUnique({
    where: { id: validatedParams.id },
    select: { id: true, userId: true, company: true, status: true },
  });

  if (!internship) {
    return NextResponse.json(
      { error: "Estágio não encontrado." },
      { status: 404 },
    );
  }

  if (internship.status !== "COMPLETED" && internship.status !== "TERMINATED") {
    return NextResponse.json(
      {
        error:
          "Apenas estágios concluídos ou encerrados podem ter horas definidas.",
      },
      { status: 409 },
    );
  }

  let file: { fileUrl: string; fileId: string };
  try {
    file = await resolveInternshipHoursFile(internship.id);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível resolver o arquivo do certificado.",
      },
      { status: 500 },
    );
  }

  await db.certificate.upsert({
    where: { internshipId: internship.id },
    update: {
      hours: body.hours,
      fileUrl: file.fileUrl,
      fileId: file.fileId,
    },
    create: {
      userId: internship.userId,
      internshipId: internship.id,
      title: `Horas de estágio — ${internship.company}`,
      certificatetype: "COMPLEMENTAR",
      status: "APPROVED",
      hours: body.hours,
      complementarHourType: null,
      fileUrl: file.fileUrl,
      fileId: file.fileId,
    },
  });

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
    const { subject, html } = studentStatusUpdateEmail({
      studentName: updated.user.name ?? "aluno(a)",
      itemLabel: "Estágio",
      statusHeadline: "Horas complementares concedidas",
      message: `Seu estágio concedeu ${body.hours}h complementares.`,
    });
    await enqueueEmail({ to: updated.user.email, subject, html });
  }

  return NextResponse.json(
    { internship: toAdminInternshipRow(updated) },
    { status: 200 },
  );
}
