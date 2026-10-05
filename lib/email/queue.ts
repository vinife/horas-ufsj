import { Queue } from "bullmq";
import type { OutgoingEmail } from "./gmail-client";

const QUEUE_NAME = "emails";

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/**
 * Enfileira um email pra envio assíncrono — nunca bloqueia nem falha a
 * resposta da request que disparou o evento. Falhas de envio (ex.: a
 * delegação do Gmail ainda não foi configurada) ficam só no log do worker.
 */
export async function enqueueEmail(email: OutgoingEmail) {
  try {
    await emailQueue.add("send-email", email);
  } catch (error) {
    console.error("[EmailQueue] Falha ao enfileirar email:", error);
  }
}
