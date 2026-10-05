import { db } from "@/lib/db";
import { enqueueEmail } from "@/lib/email/queue";
import { coordinatorNotificationEmail } from "@/lib/email/templates";
import { extensionProjectFormSchema } from "@/lib/schemas/extension.schema";
import { validateJsonRequest } from "@/lib/validators/validate-request";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireStudentSession, toProjectPayload } from "./_shared";

export async function GET(request: NextRequest) {
  const auth = await requireStudentSession(request);
  if (auth instanceof Response) return auth;
  const { session } = auth;

  const projects = await db.extensionProject.findMany({
    where: { userId: session.sub },
    include: { certificate: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    { projects: projects.map(toProjectPayload) },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireStudentSession(request);
  if (auth instanceof Response) return auth;
  const { session } = auth;

  const body = await validateJsonRequest(request, extensionProjectFormSchema);
  if (body instanceof Response) return body;

  const created = await db.extensionProject.create({
    data: {
      userId: session.sub,
      title: body.title,
      coordinatorName: body.coordinatorName,
      coordinatorEmail: body.coordinatorEmail,
      coordinatorInstitution: body.coordinatorInstitution,
      workPlan: body.workPlan,
      status: "PENDING",
    },
    include: { certificate: true },
  });

  const { subject, html } = coordinatorNotificationEmail({
    coordinatorName: body.coordinatorName,
    studentName: session.name ?? session.email ?? "um(a) aluno(a)",
    projectTitle: body.title,
  });
  await enqueueEmail({ to: body.coordinatorEmail, subject, html });

  return NextResponse.json(
    { project: toProjectPayload(created) },
    { status: 201 },
  );
}
