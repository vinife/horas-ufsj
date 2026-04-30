import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import type { CertificateType, Prisma } from "@prisma/client";
import { google } from "googleapis";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";

type UploadType = "complementar" | "extensao";
type LimitStrategy = "reject" | "clamp";

const HOURS_LIMIT_BY_TYPE: Record<UploadType, number> = {
  complementar: Number(process.env.MAX_HOURS_COMPLEMENTAR ?? 120),
  extensao: Number(process.env.MAX_HOURS_EXTENSAO ?? 120),
};

const HOURS_LIMIT_STRATEGY: LimitStrategy =
  process.env.HOURS_LIMIT_STRATEGY === "clamp" ? "clamp" : "reject";

function toCertificateType(uploadType: UploadType) {
  return (
    uploadType === "extensao" ? "EXTENSÃO" : "COMPLEMENTAR"
  ) satisfies CertificateType;
}

function toTypeFolderName(uploadType: UploadType) {
  return uploadType === "extensao" ? "Extensao" : "Complementar";
}

function getServiceAccountCredentials() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;

  if (json) {
    return JSON.parse(json);
  }
  if (base64) {
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(decoded);
  }
  throw new Error(
    "Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_BASE64",
  );
}

function toSafeFolderName(name: string) {
  return name
    .trim()
    .replace(/[\\/:*?"<>|#%]/g, "-")
    .slice(0, 120);
}

function getErrorStatus(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }

  if (
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response &&
    typeof error.response.status === "number"
  ) {
    return error.response.status;
  }

  return null;
}

function getDriveFileIdFromUrl(fileUrl: string) {
  try {
    const url = new URL(fileUrl);
    const idFromQuery = url.searchParams.get("id")?.trim();
    if (idFromQuery) {
      return idFromQuery;
    }

    const match =
      url.pathname.match(/\/file\/d\/([^/]+)/) ??
      url.pathname.match(/\/d\/([^/]+)/);

    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function removeFileFromDrive(
  drive: ReturnType<typeof google.drive>,
  fileId: string,
) {
  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    return;
  } catch (error) {
    const status = getErrorStatus(error);

    if (status === 404) {
      return;
    }

    if (status !== 403) {
      throw error;
    }
  }

  try {
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      supportsAllDrives: true,
      fields: "id, trashed",
    });
  } catch (error) {
    const status = getErrorStatus(error);

    if (status === 404) {
      return;
    }

    throw new Error(
      "Nao foi possivel remover o arquivo do Google Drive. Verifique se a conta de servico tem permissao para excluir ou mover o item para a lixeira no Shared Drive.",
    );
  }
}

async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  return google.drive({ version: "v3", auth });
}

type DriveParentContext = {
  id: string;
  sharedDriveId?: string;
};

function getConfiguredSharedDriveId() {
  const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID?.trim();
  return sharedDriveId || undefined;
}

function looksLikeSharedDriveId(id: string) {
  return /^0A[A-Za-z0-9_-]+$/.test(id);
}

async function resolveDriveParent(
  drive: ReturnType<typeof google.drive>,
  id: string,
): Promise<DriveParentContext> {
  if (id === "root") {
    return { id };
  }

  const configuredSharedDriveId = getConfiguredSharedDriveId();

  try {
    const file = await drive.files.get({
      fileId: id,
      fields: "id, driveId",
      supportsAllDrives: true,
    });

    return {
      id,
      sharedDriveId: file.data.driveId ?? configuredSharedDriveId,
    };
  } catch (error) {
    if (getErrorStatus(error) !== 404) {
      throw error;
    }
  }

  // Inference: IDs starting with 0A are commonly Shared Drive IDs.
  const inferredSharedDriveId =
    configuredSharedDriveId ?? (looksLikeSharedDriveId(id) ? id : undefined);

  return {
    id,
    sharedDriveId: inferredSharedDriveId,
  };
}

async function ensureStudentFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
) {
  const parentFolderId = process.env.GOOGLE_DRIVE_STUDENTS_FOLDER_ID || "root";
  const parent = await resolveDriveParent(drive, parentFolderId);
  return ensureChildFolder(drive, parent, name);
}

async function ensureChildFolder(
  drive: ReturnType<typeof google.drive>,
  parent: DriveParentContext,
  name: string,
) {
  const safeName = toSafeFolderName(name);
  const query = [
    "mimeType = 'application/vnd.google-apps.folder'",
    `name = '${safeName.replace(/'/g, "\\'")}'`,
    `'${parent.id}' in parents`,
    "trashed = false",
  ].join(" and ");

  const existing = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(parent.sharedDriveId
      ? {
          driveId: parent.sharedDriveId,
          corpora: "drive" as const,
        }
      : {}),
  });

  if (existing.data.files && existing.data.files.length > 0) {
    return {
      id: existing.data.files[0].id as string,
      sharedDriveId: parent.sharedDriveId,
    };
  }

  const created = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parent.id],
    },
    fields: "id",
    supportsAllDrives: true,
    // includeItemsFromAllDrives: true,
  });

  return {
    id: created.data.id as string,
    sharedDriveId: parent.sharedDriveId,
  };
}

export function createUploadHandlers(uploadType: UploadType) {
  async function GET(request: NextRequest) {
    const sessionId = request.cookies.get("session")?.value;
    if (!sessionId) {
      return NextResponse.json({ files: [] }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ files: [] }, { status: 401 });
    }
    if (session.role !== "student") {
      return NextResponse.json({ files: [] }, { status: 403 });
    }

    const search = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    const where: Prisma.CertificateWhereInput = {
      certificatetype: toCertificateType(uploadType),
      userId: session.sub,
    };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        // { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const files = await db.certificate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        hours: true,
        status: true,
        fileUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ files }, { status: 200 });
  }

  async function POST(request: NextRequest) {
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

    const form = await request.formData();
    const file = form.get("file");
    const rawTitle = String(form.get("title") ?? "").trim();
    const rawHours = form.get("hours");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const title = rawTitle || file.name.replace(/\.[^.]+$/, "");
    const hours =
      rawHours === null || String(rawHours).trim() === ""
        ? 1
        : Number(rawHours);

    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    if (!Number.isFinite(hours) || !Number.isInteger(hours) || hours <= 0) {
      return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
    }

    const hoursLimit = HOURS_LIMIT_BY_TYPE[uploadType];
    if (
      !Number.isFinite(hoursLimit) ||
      !Number.isInteger(hoursLimit) ||
      hoursLimit <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid hours limit configuration" },
        { status: 500 },
      );
    }

    const certificateType = toCertificateType(uploadType);
    const usageWhere: Prisma.CertificateWhereInput = {
      userId: session.sub,
      certificatetype: certificateType,
      status: { not: "REJECTED" },
    };
    const usage = await db.certificate.aggregate({
      where: usageWhere,
      _sum: { hours: true },
    });
    const usedHours = usage._sum.hours ?? 0;
    const remainingHours = Math.max(hoursLimit - usedHours, 0);

    if (remainingHours <= 0) {
      return NextResponse.json(
        {
          error: `Limite de ${hoursLimit}h para ${uploadType} já foi atingido.`,
          limit: hoursLimit,
          used: usedHours,
          remaining: 0,
        },
        { status: 400 },
      );
    }

    const acceptedHours =
      hours > remainingHours && HOURS_LIMIT_STRATEGY === "clamp"
        ? remainingHours
        : hours;

    if (acceptedHours > remainingHours) {
      return NextResponse.json(
        {
          error: `Envio excede o limite de ${hoursLimit}h para ${uploadType}. Restam ${remainingHours}h.`,
          limit: hoursLimit,
          used: usedHours,
          remaining: remainingHours,
        },
        { status: 400 },
      );
    }

    const drive = await getDriveClient();
    const folderName =
      session.name ?? session.email?.split("@")[0] ?? session.sub;
    const studentFolder = await ensureStudentFolder(drive, folderName);
    const typeFolder = await ensureChildFolder(
      drive,
      studentFolder,
      toTypeFolderName(uploadType),
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
      // includeItemsFromAllDrives: true,
      fields: "id, webViewLink",
    });

    const created = await db.certificate.create({
      data: {
        title,
        // description: uploadType,
        certificatetype: certificateType,
        hours: acceptedHours,
        fileUrl: uploaded.data.webViewLink ?? "",
        fileId: uploaded.data.id ?? "",
        status: "PENDING",
        userId: session.sub,
      } satisfies Prisma.CertificateUncheckedCreateInput,
      select: {
        id: true,
        title: true,
        hours: true,
        status: true,
        fileUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ file: created }, { status: 201 });
  }

  async function DELETE(request: NextRequest) {
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

    const certificateId = request.nextUrl.searchParams.get("id")?.trim();
    if (!certificateId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const deleteWhere: Prisma.CertificateWhereInput = {
      id: certificateId,
      userId: session.sub,
      certificatetype: toCertificateType(uploadType),
    };

    const certificate = await db.certificate.findFirst({
      where: deleteWhere,
      select: {
        id: true,
        fileId: true,
        fileUrl: true,
        status: true,
      },
    });

    if (!certificate) {
      return NextResponse.json(
        { error: "Arquivo não encontrado." },
        { status: 404 },
      );
    }

    if (certificate.status === "APPROVED") {
      return NextResponse.json(
        { error: "Arquivos aprovados não podem ser excluídos." },
        { status: 400 },
      );
    }

    const driveFileId =
      getDriveFileIdFromUrl(certificate.fileUrl) ?? certificate.fileId;

    if (driveFileId) {
      const drive = await getDriveClient();

      await removeFileFromDrive(drive, driveFileId);
    }

    await db.certificate.delete({
      where: { id: certificate.id },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  return { GET, POST, DELETE };
}
