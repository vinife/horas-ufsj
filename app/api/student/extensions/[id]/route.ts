import { db } from "@/lib/db";
import { extensionProjectFormSchema } from "@/lib/schemas/extension.schema";
import {
  validateJsonRequest,
  validateRouteParams,
} from "@/lib/validators/validate-request";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudentSession, toProjectPayload } from "../_shared";

const routeParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireStudentSession(request);
  if (auth instanceof Response) return auth;
  const { session } = auth;

  const params = await context.params;
  const validatedParams = validateRouteParams(params, routeParamsSchema);
  if (validatedParams instanceof Response) return validatedParams;

  const body = await validateJsonRequest(request, extensionProjectFormSchema);
  if (body instanceof Response) return body;

  const project = await db.extensionProject.findUnique({
    where: { id: validatedParams.id },
  });

  if (!project || project.userId !== session.sub) {
    return NextResponse.json(
      { error: "Projeto de extensão não encontrado." },
      { status: 404 },
    );
  }

  if (project.status !== "REJECTED") {
    return NextResponse.json(
      {
        error:
          "Apenas propostas rejeitadas podem ser corrigidas e reenviadas.",
      },
      { status: 409 },
    );
  }

  const updated = await db.extensionProject.update({
    where: { id: project.id },
    data: {
      title: body.title,
      coordinatorName: body.coordinatorName,
      coordinatorEmail: body.coordinatorEmail,
      coordinatorInstitution: body.coordinatorInstitution,
      workPlan: body.workPlan,
      status: "PENDING",
      feedback: null,
    },
    include: { certificate: true },
  });

  return NextResponse.json(
    { project: toProjectPayload(updated) },
    { status: 200 },
  );
}
