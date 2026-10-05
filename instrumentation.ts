import type { OutgoingEmail } from "@/lib/email/gmail-client";

/**
 * Next.js instrumentation hook — roda uma única vez quando o servidor sobe
 * (https://nextjs.org/docs/app/guides/instrumentation). Usado aqui pra
 * iniciar o worker do BullMQ que consome a fila "emails" dentro do próprio
 * processo do `next start`, sem precisar de um container/processo separado.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { Worker } = await import("bullmq");
  const { sendEmail } = await import("@/lib/email/gmail-client");

  const worker = new Worker<OutgoingEmail>(
    "emails",
    async (job) => {
      await sendEmail(job.data);
    },
    {
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      },
    },
  );

  worker.on("failed", (job, error) => {
    console.error(
      `[EmailWorker] Falha ao enviar email (job ${job?.id}, destinatário ${job?.data?.to}):`,
      error,
    );
  });

  worker.on("error", (error) => {
    console.error("[EmailWorker] Erro no worker de emails:", error);
  });
}
