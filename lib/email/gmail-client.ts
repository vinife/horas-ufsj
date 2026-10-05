import { google } from "googleapis";
import { getServiceAccountCredentials } from "@/lib/drive";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
};

function getSenderEmail() {
  const sender = process.env.GOOGLE_WORKSPACE_SENDER_EMAIL?.trim();
  if (!sender) {
    throw new Error(
      "Missing GOOGLE_WORKSPACE_SENDER_EMAIL — configure o email da instituição que a conta de serviço deve personificar.",
    );
  }
  return sender;
}

async function getGmailClient() {
  const sender = getSenderEmail();

  const auth = new google.auth.GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    clientOptions: { subject: sender },
  });

  return { gmail: google.gmail({ version: "v1", auth }), sender };
}

function encodeMimeWord(text: string) {
  // Cabeçalhos de email só aceitam ASCII — texto com acentos vira
  // "encoded word" (RFC 2047) em UTF-8/Base64.
  return `=?UTF-8?B?${Buffer.from(text, "utf-8").toString("base64")}?=`;
}

function buildRawMessage({ to, subject, html }: OutgoingEmail, from: string) {
  const headers = [
    `From: ${encodeMimeWord("Sistema de Horas UFSJ")} <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeMimeWord(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];

  const body = Buffer.from(html, "utf-8").toString("base64");
  const message = `${headers.join("\r\n")}\r\n\r\n${body}`;

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendEmail(email: OutgoingEmail) {
  const { gmail, sender } = await getGmailClient();
  const raw = buildRawMessage(email, sender);

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}
