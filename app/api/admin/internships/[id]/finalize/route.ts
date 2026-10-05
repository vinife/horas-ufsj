import { db } from "@/lib/db";
import { finalizeInternshipSchema } from "@/lib/schemas/internship.schema";
import {
  validateJsonRequest,
  validateRouteParams,
} from "@/lib/validators/validate-request";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternshipAdmin, toAdminInternshipRow } from "../../_shared";

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

  const body = await validateJsonRequest(request, finalizeInternshipSchema);
  if (body instanceof Response) return body;

  const internship = await db.internship.findUnique({
    where: { id: validatedParams.id },
  });

  if (!internship) {
    return NextResponse.json(
      { error: "Estágio não encontrado." },
      { status: 404 },
    );
  }

  if (internship.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Apenas estágios ativos podem ser finalizados." },
      { status: 409 },
    );
  }

  const updated = await db.internship.update({
    where: { id: internship.id },
    data: { status: body.status },
    include: {
      user: { select: { name: true, email: true } },
      submissions: true,
    },
  });

  return NextResponse.json(
    { internship: toAdminInternshipRow(updated) },
    { status: 200 },
  );
}
