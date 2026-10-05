import { db } from "@/lib/db";
import { getDriveFileIdFromUrl, streamDriveFile } from "@/lib/drive";
import { getSession } from "@/lib/session";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const sessionId = request.cookies.get("session")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const document = await db.internshipDocument.findUnique({
    where: { id },
    select: {
      fileId: true,
      fileUrl: true,
      internship: { select: { userId: true } },
    },
  });

  if (!document) {
    return NextResponse.json(
      { error: "Arquivo não encontrado." },
      { status: 404 },
    );
  }

  if (session.role === "student") {
    if (document.internship.userId !== session.sub) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (session.role === "admin") {
    const adminUser = await db.user.findUnique({
      where: { id: session.sub },
      select: { role: true, accessStatus: true, canManageEstagio: true },
    });

    if (
      !adminUser ||
      adminUser.role !== "ADMIN" ||
      adminUser.accessStatus !== "APPROVED" ||
      !adminUser.canManageEstagio
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fileId = document.fileId || getDriveFileIdFromUrl(document.fileUrl);
  if (!fileId) {
    return NextResponse.json(
      { error: "Arquivo sem referência válida no Google Drive." },
      { status: 500 },
    );
  }

  try {
    return await streamDriveFile(fileId);
  } catch (error) {
    console.error(
      "[Files API] Falha ao baixar documento de estágio do Drive:",
      error,
    );
    return NextResponse.json(
      { error: "Não foi possível carregar o arquivo." },
      { status: 502 },
    );
  }
}
