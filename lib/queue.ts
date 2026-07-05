import { Queue } from "bullmq";

// Nome da fila principal (deve bater exatamente com o que o Python escuta)
const QUEUE_NAME = "certificados";

// Instancia a Fila do BullMQ globalmente para não recriar conexões em Serverless/Fastify
export const certificadoQueue = new Queue(QUEUE_NAME, {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    // Caso use senha no Docker do Redis:
    // password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    attempts: 3, // Se falhar no Python (Ex: timeout do Gemini), tenta mais 2 vezes automaticamente
    backoff: {
      type: "exponential",
      delay: 5000, // Aguarda 5s antes da primeira retentativa, dobrando o tempo nas próximas
    },
    removeOnComplete: true, // Limpa o job do Redis após o sucesso para não encher a RAM
    removeOnFail: false, // Mantém logs de falha no Redis para você conseguir debugar
  },
});

/**
 * Função enxuta para adicionar o certificado à esteira do BullMQ
 */
export async function enqueueCertificate(certificadoId: string) {
  try {
    // No BullMQ, adicionamos um "Nome de Ação" (ex: 'validar-ia') e o Payload de dados (um objeto)
    const job = await certificadoQueue.add("validar-ia", {
      certificate_id: certificadoId,
    });

    console.log(
      `[BullMQ] Job ${job.id} para o Certificado ${certificadoId} criado com sucesso.`,
    );
    return job;
  } catch (error) {
    console.error("Erro ao injetar job no BullMQ:", error);
    throw error;
  }
}

/// // src/lib/queue.ts
// import { getRedis } from "@/lib/redis";

// // Padronização do nome da chave da fila no Redis
// const CERTIFICATE_QUEUE_KEY = "fila:certificados";

// /**
//  * Adiciona o ID de um certificado na fila para processamento da IA (Gemini).
//  * Implementa uma estrutura FIFO usando LPUSH.
//  * * @param certificateId O ID do certificado gerado pelo Prisma
//  */
// export async function enqueueCertificate(
//   certificateId: string,
// ): Promise<boolean> {
//   try {
//     const redis = await getRedis();

//     // Insere o ID no início da lista do Redis
//     await redis.lPush(CERTIFICATE_QUEUE_KEY, certificateId);

//     console.log(`[Queue] Certificado ${certificateId} adicionado com sucesso.`);
//     return true;
//   } catch (error) {
//     console.error(
//       `[Queue Error] Falha ao enfileirar o certificado ${certificateId}:`,
//       error,
//     );
//     // Retornamos false para que o Next.js saiba que a inserção na fila falhou
//     return false;
//   }
// }

// /**
//  * Retorna a quantidade atual de certificados aguardando na fila.
//  * Muito útil para monitoramento ou dashboards do Administrador.
//  */
// export async function getQueueLength(): Promise<number> {
//   try {
//     const redis = await getRedis();
//     return await redis.lLen(CERTIFICATE_QUEUE_KEY);
//   } catch (error) {
//     console.error("[Queue Error] Erro ao obter tamanho da fila:", error);
//     return 0;
//   }
// }
