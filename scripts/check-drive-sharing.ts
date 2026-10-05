import "dotenv/config";
import { getDriveClient } from "../lib/drive";
import { db } from "../lib/db";

/**
 * Diagnostic script — checks whether a file uploaded to Google Drive by this
 * app actually has the "anyone with the link" reader permission the upload
 * routes try to set (app/api/student/uploads/_shared.ts,
 * app/api/student/internship/_shared.ts). That permission call is wrapped in
 * a try/catch that silently logs on failure, so the only way to know for
 * sure is to ask Drive directly what permissions the file currently has.
 *
 * Usage:
 *   bunx tsx scripts/check-drive-sharing.ts [fileId]
 *
 * With no fileId, it looks up the most recently uploaded file across
 * Certificate and InternshipSubmission and checks that one.
 */

async function findMostRecentFileId(): Promise<{
  fileId: string;
  source: string;
  createdAt: Date;
} | null> {
  const [latestCertificate, latestSubmission] = await Promise.all([
    db.certificate.findFirst({
      orderBy: { createdAt: "desc" },
      select: { fileId: true, title: true, createdAt: true },
    }),
    db.internshipSubmission.findFirst({
      orderBy: { createdAt: "desc" },
      select: { fileId: true, createdAt: true, kind: true },
    }),
  ]);

  const candidates = [
    latestCertificate && {
      fileId: latestCertificate.fileId,
      source: `Certificate "${latestCertificate.title}"`,
      createdAt: latestCertificate.createdAt,
    },
    latestSubmission && {
      fileId: latestSubmission.fileId,
      source: `InternshipSubmission (${latestSubmission.kind})`,
      createdAt: latestSubmission.createdAt,
    },
  ].filter((c): c is NonNullable<typeof c> => Boolean(c && c.fileId));

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return candidates[0];
}

async function main() {
  const argFileId = process.argv[2];

  let fileId = argFileId;
  let source = "argumento da linha de comando";

  if (!fileId) {
    const found = await findMostRecentFileId();
    if (!found) {
      console.error(
        "Nenhum fileId informado e nenhum Certificate/InternshipSubmission com fileId encontrado no banco.",
      );
      process.exit(1);
    }
    fileId = found.fileId;
    source = `${found.source}, enviado em ${found.createdAt.toISOString()}`;
  }

  console.log(`Verificando fileId: ${fileId}`);
  console.log(`Origem: ${source}\n`);

  const drive = await getDriveClient();

  const file = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: "id, name, webViewLink, driveId",
  });

  console.log(`Arquivo: ${file.data.name ?? "(sem nome)"}`);
  console.log(`Link:    ${file.data.webViewLink ?? "(sem link)"}\n`);

  const permissions = await drive.permissions.list({
    fileId,
    supportsAllDrives: true,
    fields: "permissions(id, type, role, emailAddress, domain)",
  });

  const list = permissions.data.permissions ?? [];
  console.log("Permissões atuais:");
  for (const permission of list) {
    console.log(
      `  - type=${permission.type} role=${permission.role}` +
        (permission.emailAddress ? ` email=${permission.emailAddress}` : "") +
        (permission.domain ? ` domain=${permission.domain}` : ""),
    );
  }

  const isPubliclyReadable = list.some(
    (permission) =>
      permission.type === "anyone" &&
      (permission.role === "reader" || permission.role === "writer"),
  );

  console.log();
  if (isPubliclyReadable) {
    console.log(
      "RESULTADO: link público ATIVO — qualquer pessoa com o link consegue visualizar.",
    );
  } else {
    console.log(
      "RESULTADO: link público NÃO está ativo — só quem já tem acesso explícito (ou a conta de " +
        "serviço) consegue abrir. Provável causa: a política do Workspace institucional está " +
        "bloqueando compartilhamento externo (\"Anyone with the link\") a nível de domínio — " +
        "isso é configurado no Google Admin Console, não no código. Confira o log do servidor " +
        'por "[Drive Permission Error]" durante um upload real pra confirmar se a chamada da API ' +
        "chegou a falhar.",
    );
  }
}

main()
  .catch((error) => {
    console.error("Falha ao consultar o Google Drive:", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
