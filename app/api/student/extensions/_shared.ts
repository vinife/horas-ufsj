import { db } from "@/lib/db";
import {
  ensureChildFolder,
  ensureStudentFolder,
  getDriveClient,
} from "@/lib/drive";
import { getSession, type SessionPayload } from "@/lib/session";
import type {
  Certificate,
  ExtensionProject,
  Prisma,
} from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";

const EXTENSION_DRIVE_FOLDER = "Extensao";

export type ExtensionCertificatePayload = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  hours: number | null;
  feedback: string | null;
  createdAt: string;
};

export type ExtensionProjectPayload = {
  id: string;
  title: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coordinatorInstitution: string;
  workPlan: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "COMPLETED";
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
  certificate: ExtensionCertificatePayload | null;
};

export function toCertificatePayload(
  certificate: Certificate,
): ExtensionCertificatePayload {
  return {
    id: certificate.id,
    status: certificate.status,
    hours: certificate.hours,
    feedback: certificate.feedback,
    createdAt: certificate.createdAt.toISOString(),
  };
}

export function toProjectPayload(
  project: ExtensionProject & { certificate?: Certificate | null },
): ExtensionProjectPayload {
  return {
    id: project.id,
    title: project.title,
    coordinatorName: project.coordinatorName,
    coordinatorEmail: project.coordinatorEmail,
    coordinatorInstitution: project.coordinatorInstitution,
    workPlan: project.workPlan,
    status: project.status,
    feedback: project.feedback,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    certificate: project.certificate
      ? toCertificatePayload(project.certificate)
      : null,
  };
}

export async function requireStudentSession(
  request: NextRequest,
): Promise<{ session: SessionPayload } | Response> {
  const sessionId = request.cookies.get("session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { session };
}

export async function getExtensionHoursLimit() {
  const config = await db.systemConfig.findUnique({
    where: { id: "current_config" },
    select: { extensaoLimit: true },
  });

  // O schema.prisma define o padrão como 200
  return config?.extensaoLimit ?? 200;
}

export async function getExtensionUsedHours(userId: string) {
  const usage = await db.certificate.aggregate({
    where: {
      userId,
      certificatetype: "EXTENSAO",
      extensionProjectId: { not: null },
      status: { not: "REJECTED" },
    },
    _sum: { hours: true },
  });

  return usage._sum.hours ?? 0;
}

export async function uploadExtensionCertificateFile(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  session: SessionPayload,
  file: File,
) {
  const folderName =
    session.name ?? session.email?.split("@")[0] ?? session.sub;
  const studentFolder = await ensureStudentFolder(drive, folderName);
  const typeFolder = await ensureChildFolder(
    drive,
    studentFolder,
    EXTENSION_DRIVE_FOLDER,
  );

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const stream = Readable.from(buffer);

  const uploaded = await drive.files.create({
    requestBody: {
      name: file.name,
      parents: [typeFolder.id],
    },
    media: {
      mimeType: file.type || "application/octet-stream",
      body: stream,
    },
    supportsAllDrives: true,
    fields: "id, webViewLink",
  });

  return {
    fileUrl: uploaded.data.webViewLink ?? "",
    fileId: uploaded.data.id ?? "",
  };
}

export type { Prisma };
