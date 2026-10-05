import { db } from "@/lib/db";
import {
  ensureChildFolder,
  ensureStudentFolder,
  getDriveClient,
  getDriveFileIdFromUrl,
  getErrorMessage,
  removeFileFromDrive,
} from "@/lib/drive";
import { enqueueCertificate } from "@/lib/queue";
import {
  deleteUploadQuerySchema,
  uploadFormDataSchema,
  uploadSearchQuerySchema,
} from "@/lib/schemas/upload.schema";
import { getSession } from "@/lib/session";
import { validateFormData } from "@/lib/validators/validate-form-data";
import { validateQueryParams } from "@/lib/validators/validate-request";
import type { CertificateType, Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";

type UploadType = "complementar" | "extensao";

// const HOURS_LIMIT_STRATEGY: LimitStrategy =
//   process.env.HOURS_LIMIT_STRATEGY === "clamp" ? "clamp" : "reject";
async function getHoursLimitForType(uploadType: UploadType) {
  const config = await db.systemConfig.findUnique({
    where: { id: "current_config" },
    select: { complementarLimit: true, extensaoLimit: true },
  });

  if (uploadType === "extensao") {
    // O schema.prisma define o padrão como 200
    return config?.extensaoLimit ?? 200;
  }
  // O schema.prisma define o padrão como 120
  return config?.complementarLimit ?? 120;
}

function toCertificateType(uploadType: UploadType) {
  return (
    uploadType === "extensao" ? "EXTENSAO" : "COMPLEMENTAR"
  ) satisfies CertificateType;
}

function toTypeFolderName(uploadType: UploadType) {
  return uploadType === "extensao" ? "Extensao" : "Complementar";
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

    const query = validateQueryParams(
      request.nextUrl.searchParams,
      uploadSearchQuerySchema,
    );
    if (query instanceof Response) return query;

    const search = query.q.trim();
    const limit = await getHoursLimitForType(uploadType);

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
        feedback: true,
      },
    });

    return NextResponse.json(
      {
        files,
        limit,
      },
      { status: 200 },
    );
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
    const validationResult = validateFormData(form, uploadFormDataSchema);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error, issues: validationResult.issues },
        { status: 422 },
      );
    }

    const parsed = validationResult.data;
    const file = parsed.file;
    const title = parsed.title?.trim() || file.name.replace(/\.[^.]+$/, "");
    const hours = parsed.hours ?? 1;

    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    if (!Number.isFinite(hours) || !Number.isInteger(hours) || hours <= 0) {
      return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
    }

    const hoursLimit = await getHoursLimitForType(uploadType);
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

    // const acceptedHours =
    //   hours > remainingHours && HOURS_LIMIT_STRATEGY === "clamp"
    //     ? remainingHours
    //     : hours;

    // if (acceptedHours > remainingHours) {
    //   return NextResponse.json(
    //     {
    //       error: `Envio excede o limite de ${hoursLimit}h para ${uploadType}. Restam ${remainingHours}h.`,
    //       limit: hoursLimit,
    //       used: usedHours,
    //       remaining: remainingHours,
    //     },
    //     { status: 400 },
    //   );
    // }

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

    // Não tentamos mais tornar o arquivo público ("anyone with the link") —
    // a política do Workspace institucional da UFSJ bloqueia isso em Shared
    // Drives. O arquivo é servido via app/api/files/certificate/[id]/route.ts,
    // que baixa os bytes usando a conta de serviço (que já tem acesso
    // garantido) e aplica o próprio controle de acesso da aplicação.

    const created = await db.certificate.create({
      data: {
        title,
        // description: uploadType,
        certificatetype: certificateType,
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

    const enfileiradoComSucesso = await enqueueCertificate(created.id);

    // Se o Redis falhar por problemas de infraestrutura, atualiza o banco com o alerta técnico
    if (!enfileiradoComSucesso) {
      console.error(
        `[Queue Error] Falha ao enfileirar ID ${created.id}. Atualizando banco.`,
      );
      await db.certificate.update({
        where: { id: created.id },
        data: {
          aiStatus: "FAILED",
          aiFeedback:
            "Erro temporário no servidor de mensageria. A análise automática foi abortada.",
        },
      });
    }

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

    const query = validateQueryParams(
      request.nextUrl.searchParams,
      deleteUploadQuerySchema,
    );
    if (query instanceof Response) return query;

    const certificateId = query.id;

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
      certificate.fileId || getDriveFileIdFromUrl(certificate.fileUrl);

    if (!driveFileId) {
      return NextResponse.json(
        { error: "Arquivo sem ID do Google Drive salvo no banco." },
        { status: 500 },
      );
    }

    try {
      const drive = await getDriveClient();

      await removeFileFromDrive(drive, driveFileId);
    } catch (error) {
      return NextResponse.json(
        {
          error: `Nao foi possivel remover o arquivo do Google Drive: ${getErrorMessage(error)}`,
        },
        { status: 500 },
      );
    }

    await db.certificate.delete({
      where: { id: certificate.id },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  return { GET, POST, DELETE };
}
