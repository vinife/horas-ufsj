import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { Readable } from "node:stream"
import { google } from "googleapis"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get("session")?.value
  if (!sessionId) {
    return NextResponse.json({ files: [] }, { status: 401 })
  }

  const session = await getSession(sessionId)
  if (!session) {
    return NextResponse.json({ files: [] }, { status: 401 })
  }

  const where =
    session.role === "admin" ? undefined : { userId: session.sub }

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
  })

  return NextResponse.json({ files }, { status: 200 })
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
  return name.trim().replace(/[\\/:*?"<>|#%]/g, "-").slice(0, 120)
}

async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  })

  return google.drive({ version: "v3", auth })
}

async function ensureStudentFolder(drive: ReturnType<typeof google.drive>, name: string) {
  const safeName = toSafeFolderName(name)
  const query = [
    "mimeType = 'application/vnd.google-apps.folder'",
    `name = '${safeName.replace(/'/g, "\\'")}'`,
    "'root' in parents",
    "trashed = false",
  ].join(" and ")

  const existing = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    spaces: "drive",
  })

  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id as string
  }

  const created = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: "application/vnd.google-apps.folder",
      parents: ["root"],
    },
    fields: "id",
  })

  return created.data.id as string
}

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get("session")?.value
  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const session = await getSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get("file")
  const title = String(form.get("title") ?? "").trim()
  const hours = Number(form.get("hours") ?? 0)

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 })
  }

  if (!Number.isFinite(hours) || hours <= 0) {
    return NextResponse.json({ error: "Invalid hours" }, { status: 400 })
  }

  const drive = await getDriveClient()
  const folderName =
    session.name ??
    session.email?.split("@")[0] ??
    session.sub
  const folderId = await ensureStudentFolder(drive, folderName)

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const stream = Readable.from(buffer)

  const uploaded = await drive.files.create({
    requestBody: {
      name: file.name,
      parents: [folderId],
    },
    media: {
      mimeType: file.type || "application/octet-stream",
      body: stream,
    },
    fields: "id, webViewLink",
  })

  const created = await db.certificate.create({
    data: {
      title,
      hours,
      fileUrl: uploaded.data.webViewLink ?? "",
      fileId: uploaded.data.id ?? "",
      status: "PENDENTE",
      userId: session.sub,
    },
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
