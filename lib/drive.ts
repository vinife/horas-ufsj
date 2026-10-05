import { google } from "googleapis";
import { Readable } from "node:stream";
import { acceptedMimeTypes } from "@/lib/schemas/upload.schema";

const SAFE_MIME_TYPES = new Set<string>(acceptedMimeTypes);

export function getServiceAccountCredentials() {
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

export function toSafeFolderName(name: string) {
  return name
    .trim()
    .replace(/[\\/:*?"<>|#%]/g, "-")
    .slice(0, 120);
}

export function getErrorStatus(error: unknown) {
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

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Erro desconhecido.";
}

export function getDriveFileIdFromUrl(fileUrl: string) {
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

export async function removeFileFromDrive(
  drive: ReturnType<typeof google.drive>,
  fileId: string,
) {
  const file = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: "id, trashed, capabilities(canDelete, canTrash)",
  });

  if (file.data.trashed) {
    return;
  }

  const canDelete = file.data.capabilities?.canDelete === true;
  const canTrash = file.data.capabilities?.canTrash === true;

  if (canDelete) {
    try {
      await drive.files.delete({
        fileId,
        supportsAllDrives: true,
      });
      return;
    } catch (error) {
      if (!canTrash) {
        throw error;
      }
    }
  }

  if (!canTrash) {
    throw new Error(
      "A conta de servico consegue acessar o arquivo, mas nao tem permissao para excluir nem mover para a lixeira no Google Drive.",
    );
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
      throw new Error(
        "Arquivo nao encontrado no Google Drive para mover para a lixeira. Verifique as permissoes da conta de servico.",
      );
    }

    throw new Error(
      "Nao foi possivel remover o arquivo do Google Drive. Verifique se a conta de servico tem permissao para excluir ou mover o item para a lixeira no Shared Drive.",
    );
  }
}

export async function getDriveClient() {
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

export function getConfiguredSharedDriveId() {
  const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID?.trim();
  return sharedDriveId || undefined;
}

export function looksLikeSharedDriveId(id: string) {
  return /^0A[A-Za-z0-9_-]+$/.test(id);
}

export async function resolveDriveParent(
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

export async function ensureStudentFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
) {
  const parentFolderId = process.env.GOOGLE_DRIVE_STUDENTS_FOLDER_ID || "root";
  const parent = await resolveDriveParent(drive, parentFolderId);
  return ensureChildFolder(drive, parent, name);
}

export async function ensureChildFolder(
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
  });

  return {
    id: created.data.id as string,
    sharedDriveId: parent.sharedDriveId,
  };
}

/**
 * Streams a Drive file's bytes through our own server instead of relying on
 * the file being publicly shared ("anyone with the link") — the service
 * account already has direct access to anything it uploaded (it's a
 * fileOrganizer on the Shared Drive), regardless of whether the
 * institution's Workspace policy allows external link sharing. Callers are
 * responsible for their own auth/ownership checks before calling this.
 */
export async function streamDriveFile(fileId: string): Promise<Response> {
  const drive = await getDriveClient();

  const meta = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: "name, mimeType",
  });

  const media = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" },
  );

  const nodeStream = media.data as unknown as Readable;
  const webStream = Readable.toWeb(
    nodeStream,
  ) as unknown as ReadableStream<Uint8Array>;

  const fileName = meta.data.name ?? "arquivo";

  // The stored mimeType reflects whatever the uploader's request claimed at
  // upload time — not verified against the actual bytes — so it can't be
  // trusted to pick a Content-Type to serve back. Clamp to the same
  // allowlist enforced at upload (lib/schemas/upload.schema.ts): anything
  // else (including text/html, image/svg+xml, etc.) falls back to a type
  // browsers never execute or render as markup. Combined with `attachment`
  // (ignored by the <img>/react-pdf subresource fetches our own viewer
  // uses, so this doesn't affect in-app preview) and `nosniff`, this closes
  // off MIME-confusion XSS on this first-party, cookie-bearing origin.
  const safeMimeType = SAFE_MIME_TYPES.has(meta.data.mimeType ?? "")
    ? (meta.data.mimeType as string)
    : "application/octet-stream";

  return new Response(webStream, {
    headers: {
      "Content-Type": safeMimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; frame-ancestors 'self'",
      "Cache-Control": "private, max-age=60",
    },
  });
}
