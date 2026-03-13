import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { Readable } from "node:stream"
import { google } from "googleapis"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

type UploadType = "complementar" | "extensao"
type LimitStrategy = "reject" | "clamp"

const HOURS_LIMIT_BY_TYPE: Record<UploadType, number> = {
  complementar: Number(process.env.MAX_HOURS_COMPLEMENTAR ?? 120),
  extensao: Number(process.env.MAX_HOURS_EXTENSAO ?? 120),
}

const HOURS_LIMIT_STRATEGY: LimitStrategy =
  process.env.HOURS_LIMIT_STRATEGY === "clamp" ? "clamp" : "reject"

function toCertificateType(uploadType: UploadType) {
  return uploadType === "extensao" ? "EXTENSÃO" : "COMPLEMENTAR"
}

function toTypeFolderName(uploadType: UploadType) {
  return uploadType === "extensao" ? "Extensao" : "Complementar"
}

function getServiceAccountCredentials() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64

  if (json) {
    return JSON.parse(json)
  }
  if (base64) {
    const decoded = Buffer.from(base64, "base64").toString("utf-8")
    return JSON.parse(decoded)
  }
  throw new Error(
    "Missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_BASE64",
  )
}

function toSafeFolderName(name: string) {
  return name
    .trim()
    .replace(/[\\/:*?"<>|#%]/g, "-")
    .slice(0, 120)
}

async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  })

  return google.drive({ version: "v3", auth })
}

async function ensureStudentFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
) {
  const parentFolderId = process.env.GOOGLE_DRIVE_STUDENTS_FOLDER_ID || "root"
  return ensureChildFolder(drive, parentFolderId, name)
}

async function ensureChildFolder(
  drive: ReturnType<typeof google.drive>,
  parentFolderId: string,
  name: string,
) {
  const safeName = toSafeFolderName(name)
  const query = [
    "mimeType = 'application/vnd.google-apps.folder'",
    `name = '${safeName.replace(/'/g, "\\'")}'`,
    `'${parentFolderId}' in parents`,
    "trashed = false",
  ].join(" and ")

  const existing = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    driveId: parentFolderId,
    corpora: "drive",
  })

  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id as string
  }

  const created = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  return created.data.id as string
}

export function createUploadHandlers(uploadType: UploadType) {
  async function GET(request: NextRequest) {
    const sessionId = request.cookies.get("session")?.value
    if (!sessionId) {
      return NextResponse.json({ files: [] }, { status: 401 })
    }

    const session = await getSession(sessionId)
    if (!session) {
      return NextResponse.json({ files: [] }, { status: 401 })
    }
    if (session.role !== "student") {
      return NextResponse.json({ files: [] }, { status: 403 })
    }

    const search = request.nextUrl.searchParams.get("q")?.trim() ?? ""

    const where: Record<string, unknown> = {
      type: toCertificateType(uploadType),
      userId: session.sub,
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const files = await db.certificate.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        hours: true,
        status: true,
        fileUrl: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ files }, { status: 200 })
  }

  async function POST(request: NextRequest) {
    const sessionId = request.cookies.get("session")?.value
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const session = await getSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.role !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get("file")
    const rawTitle = String(form.get("title") ?? "").trim()
    const rawHours = form.get("hours")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    const title = rawTitle || file.name.replace(/\.[^.]+$/, "")
    const hours =
      rawHours === null || String(rawHours).trim() === "" ? 1 : Number(rawHours)

    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 })
    }

    if (!Number.isFinite(hours) || !Number.isInteger(hours) || hours <= 0) {
      return NextResponse.json({ error: "Invalid hours" }, { status: 400 })
    }

    const hoursLimit = HOURS_LIMIT_BY_TYPE[uploadType]
    if (!Number.isFinite(hoursLimit) || !Number.isInteger(hoursLimit) || hoursLimit <= 0) {
      return NextResponse.json(
        { error: "Invalid hours limit configuration" },
        { status: 500 },
      )
    }

    const certificateType = toCertificateType(uploadType)
    const usage = await db.certificate.aggregate({
      where: {
        userId: session.sub,
        type: certificateType,
        status: { not: "REJEITADO" },
      } as any,
      _sum: { hours: true },
    })
    const usedHours = usage._sum.hours ?? 0
    const remainingHours = Math.max(hoursLimit - usedHours, 0)

    if (remainingHours <= 0) {
      return NextResponse.json(
        {
          error: `Limite de ${hoursLimit}h para ${uploadType} já foi atingido.`,
          limit: hoursLimit,
          used: usedHours,
          remaining: 0,
        },
        { status: 400 },
      )
    }

    const acceptedHours =
      hours > remainingHours && HOURS_LIMIT_STRATEGY === "clamp"
        ? remainingHours
        : hours

    if (acceptedHours > remainingHours) {
      return NextResponse.json(
        {
          error: `Envio excede o limite de ${hoursLimit}h para ${uploadType}. Restam ${remainingHours}h.`,
          limit: hoursLimit,
          used: usedHours,
          remaining: remainingHours,
        },
        { status: 400 },
      )
    }

    const drive = await getDriveClient()
    const folderName = session.name ?? session.email?.split("@")[0] ?? session.sub
    const studentFolderId = await ensureStudentFolder(drive, folderName)
    const typeFolderId = await ensureChildFolder(
      drive,
      studentFolderId,
      toTypeFolderName(uploadType),
    )

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const stream = Readable.from(buffer)

    const uploaded = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [typeFolderId],
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: stream,
      },
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: "id, webViewLink",
    })

    const created = await db.certificate.create({
      data: {
        title,
        description: uploadType,
        type: certificateType as any,
        hours: acceptedHours,
        fileUrl: uploaded.data.webViewLink ?? "",
        fileId: uploaded.data.id ?? "",
        status: "PENDENTE",
        userId: session.sub,
      } as any,
      select: {
        id: true,
        title: true,
        hours: true,
        status: true,
        fileUrl: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ file: created }, { status: 201 })
  }

  return { GET, POST }
}
