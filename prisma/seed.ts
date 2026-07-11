import type { Prisma } from "@prisma/client";
import { db as prisma } from "../lib/db";

const TOTAL_STUDENTS = Number(process.env.SEED_STUDENTS ?? 120);
const CERTIFICATES_PER_STUDENT = Number(
  process.env.SEED_CERTIFICATES_PER_STUDENT ?? 18,
);
const BATCH_SIZE = Number(process.env.SEED_BATCH_SIZE ?? 400);
const RESET_DATA = (process.env.SEED_RESET ?? "true").toLowerCase() === "true";

const FIRST_ADMIN_EMAIL = "admin.inicial@ufsj.edu.br";

const CERTIFICATE_TITLES = [
  "Curso de Python",
  "Minicurso de Git e GitHub",
  "Oficina de React",
  "Evento de Inovacao",
  "Semana Academica de Computacao",
  "Projeto de Extensao em Comunidade",
  "Workshop de Design de Sistemas",
  "Curso de Banco de Dados",
  "Treinamento de Metodologia Cientifica",
  "Maratona de Programacao",
];

const CERTIFICATE_TYPES = ["COMPLEMENTAR", "EXTENSAO"] as const;
const STATUS_POOL = ["PENDING", "APPROVED", "REJECTED"] as const;
const STATUS_WEIGHTS = [55, 35, 10];
const REVIEWED_STATUS_POOL = ["APPROVED", "REJECTED"] as const;
const REVIEWED_STATUS_WEIGHTS = [80, 20];

type StudentSeed = {
  id: string;
  email: string;
  name: string;
};

type CertificateStatus = (typeof STATUS_POOL)[number];
type CertificateType = (typeof CERTIFICATE_TYPES)[number];

type CertificateRow = {
  title: string;
  hours: number;
  certificatetype: CertificateType;
  fileUrl: string;
  fileId: string;
  status: CertificateStatus;
  feedback: string | null;
  userId: string;
  aiStatus: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  aiSuggestedTitle: string | null;
  aiSuggestedHours: number | null;
  aiFeedback: string | null;
  createdAt: Date;
  updatedAt: Date;
  aiDecision: CertificateStatus;
  aiRaw: Prisma.InputJsonValue | null;
};

function randomFrom<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function weightedStatus() {
  const roll = Math.random() * 100;
  let acc = 0;

  for (let i = 0; i < STATUS_POOL.length; i += 1) {
    acc += STATUS_WEIGHTS[i] ?? 0;
    if (roll <= acc) return STATUS_POOL[i];
  }

  return "PENDING";
}

function weightedReviewedStatus() {
  const roll = Math.random() * 100;
  let acc = 0;

  for (let i = 0; i < REVIEWED_STATUS_POOL.length; i += 1) {
    acc += REVIEWED_STATUS_WEIGHTS[i] ?? 0;
    if (roll <= acc) return REVIEWED_STATUS_POOL[i];
  }

  return "APPROVED";
}

function randomDateInLastMonths(months = 18) {
  const now = Date.now();
  const span = months * 30 * 24 * 60 * 60 * 1000;
  return new Date(now - Math.floor(Math.random() * span));
}

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function createBaseUsers() {
  const firstAdmin = await prisma.user.upsert({
    where: { email: FIRST_ADMIN_EMAIL },
    update: {
      name: "Admin Inicial",
      role: "ADMIN",
      accessStatus: "APPROVED",
      reviewedAt: new Date(),
      canManageComplementar: true,
      canManageExtensao: true,
      canManageUsers: true,
    },
    create: {
      name: "Admin Inicial",
      email: FIRST_ADMIN_EMAIL,
      role: "ADMIN",
      accessStatus: "APPROVED",
      reviewedAt: new Date(),
      canManageComplementar: true,
      canManageExtensao: true,
      canManageUsers: true,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@ufsj.edu.br" },
    update: {
      name: "Admin UFSJ",
      role: "ADMIN",
      accessStatus: "APPROVED",
      reviewedAt: new Date(),
      canManageComplementar: false,
      canManageExtensao: false,
      canManageUsers: false,
    },
    create: {
      name: "Admin UFSJ",
      email: "admin@ufsj.edu.br",
      role: "ADMIN",
      accessStatus: "APPROVED",
      reviewedAt: new Date(),
      canManageComplementar: false,
      canManageExtensao: false,
      canManageUsers: false,
    },
  });

  const reviewer = await prisma.user.upsert({
    where: { email: "coordenacao@ufsj.edu.br" },
    update: {
      name: "Coordenacao UFSJ",
      role: "ADMIN",
      accessStatus: "APPROVED",
      reviewedAt: new Date(),
      canManageComplementar: false,
      canManageExtensao: false,
      canManageUsers: false,
    },
    create: {
      name: "Coordenacao UFSJ",
      email: "coordenacao@ufsj.edu.br",
      role: "ADMIN",
      accessStatus: "APPROVED",
      reviewedAt: new Date(),
      canManageComplementar: false,
      canManageExtensao: false,
      canManageUsers: false,
    },
  });

  await prisma.user.upsert({
    where: { email: "pendente.solicitacao@aluno.ufsj.edu.br" },
    update: {
      name: "Solicitacao Pendente",
      role: "STUDENT",
      accessStatus: "PENDING",
      reviewedAt: null,
    },
    create: {
      name: "Solicitacao Pendente",
      email: "pendente.solicitacao@aluno.ufsj.edu.br",
      role: "STUDENT",
      accessStatus: "PENDING",
    },
  });

  await prisma.user.upsert({
    where: { email: "solicitacao.rejeitada@aluno.ufsj.edu.br" },
    update: {
      name: "Solicitacao Rejeitada",
      role: "STUDENT",
      accessStatus: "REJECTED",
      reviewedAt: new Date(),
    },
    create: {
      name: "Solicitacao Rejeitada",
      email: "solicitacao.rejeitada@aluno.ufsj.edu.br",
      role: "STUDENT",
      accessStatus: "REJECTED",
      reviewedAt: new Date(),
    },
  });

  await prisma.systemConfig.upsert({
    where: { id: "current_config" },
    update: {
      tunedTextModel: "tunedModels/gemini-ufsj-texto-v1",
    },
    create: {
      id: "current_config",
      tunedTextModel: "tunedModels/gemini-ufsj-texto-v1",
    },
  });

  return [firstAdmin, admin, reviewer];
}

async function createStudents(total: number) {
  const students: StudentSeed[] = [];

  for (let i = 1; i <= total; i += 1) {
    const name = `Aluno ${String(i).padStart(4, "0")}`;
    const email = `aluno${String(i).padStart(4, "0")}@aluno.ufsj.edu.br`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role: "STUDENT",
        accessStatus: "APPROVED",
        reviewedAt: new Date(),
      },
      create: {
        name,
        email,
        role: "STUDENT",
        accessStatus: "APPROVED",
        reviewedAt: new Date(),
      },
      select: { id: true, email: true, name: true },
    });

    students.push({
      id: user.id,
      email: user.email,
      name: user.name ?? name,
    });
  }

  return students;
}

async function createCertificates(students: StudentSeed[], perStudent: number) {
  const rows: CertificateRow[] = [];
  const DAY = 86400000;

  for (const [studentIndex, student] of students.entries()) {
    const isReviewedOnlyStudent = studentIndex % 3 === 0;
    let hasPendingComplementar = false;
    let hasPendingExtensao = false;

    for (let i = 1; i <= perStudent; i += 1) {
      const title = randomFrom(CERTIFICATE_TITLES);
      const type = CERTIFICATE_TYPES[i % CERTIFICATE_TYPES.length];
      const mustForcePending = !isReviewedOnlyStudent && i === 1;

      let status: CertificateStatus;
      if (isReviewedOnlyStudent) {
        status = weightedReviewedStatus();
      } else {
        status = mustForcePending ? "PENDING" : weightedStatus();
      }

      if (status === "PENDING" && type === "COMPLEMENTAR") {
        hasPendingComplementar = true;
      }

      if (status === "PENDING" && type === "EXTENSAO") {
        hasPendingExtensao = true;
      }

      let createdAt = randomDateInLastMonths(24);

      if (status === "PENDING" && mustForcePending) {
        switch (studentIndex % 4) {
          case 0:
            // Hoje ou ontem
            createdAt = new Date(
              Date.now() - Math.floor(Math.random() * 2) * DAY,
            );
            break;

          case 1:
            // Exatamente no limite (15 dias)
            createdAt = new Date(Date.now() - 15 * DAY);
            break;

          case 2:
            // Dentro do prazo (10–14 dias)
            createdAt = new Date(
              Date.now() - (10 + Math.floor(Math.random() * 5)) * DAY,
            );
            break;

          default:
            // Fora do prazo (16–25 dias)
            createdAt = new Date(
              Date.now() - (16 + Math.floor(Math.random() * 10)) * DAY,
            );
            break;
        }
      }

      const updatedAt =
        status === "PENDING"
          ? createdAt
          : new Date(
              createdAt.getTime() + Math.floor(Math.random() * 10) * DAY,
            );

      const baseSlug = slugify(`${student.email}-${title}-${i}`);

      const aiStatus =
        status === "PENDING"
          ? Math.random() < 0.8
            ? "QUEUED"
            : "PROCESSING"
          : status === "APPROVED"
            ? "COMPLETED"
            : Math.random() < 0.7
              ? "COMPLETED"
              : "FAILED";

      const aiSuggestedHours = Math.min(120, Math.max(1, 8 + (i % 25)));

      const aiDecision =
        aiStatus === "COMPLETED" ? weightedReviewedStatus() : "PENDING";

      const aiRaw: Prisma.InputJsonValue | null =
        aiStatus === "COMPLETED"
          ? {
              confidence: Number((0.65 + (i % 30) / 100).toFixed(2)),
              extractedHours: aiSuggestedHours,
              extractedTitle: title,
              decision: aiDecision,
              reasoning: "Análise baseada em template conhecido.",
            }
          : aiStatus === "FAILED"
            ? {
                error: "Falha ao processar OCR do comprovante.",
              }
            : null;

      rows.push({
        title,
        hours: 10 + Math.floor(Math.random() * 71),
        certificatetype: type,
        fileUrl: `https://drive.google.com/file/d/${baseSlug}/view`,
        fileId: baseSlug,
        status,
        feedback:
          status === "REJECTED"
            ? "Documento ilegivel ou informacoes incompletas."
            : null,
        userId: student.id,
        aiStatus,
        aiSuggestedTitle: aiStatus === "COMPLETED" ? `${title} (IA)` : null,
        aiSuggestedHours: aiStatus === "COMPLETED" ? aiSuggestedHours : null,
        aiFeedback: aiRaw ? JSON.stringify(aiRaw, null, 2) : null,
        aiDecision,
        aiRaw,
        createdAt,
        updatedAt,
      });
    }

    if (!isReviewedOnlyStudent && !hasPendingComplementar) {
      const fallbackTitle = randomFrom(CERTIFICATE_TITLES);
      const createdAt = new Date(Date.now() - 2 * DAY);
      const baseSlug = slugify(`${student.email}-${fallbackTitle}-pending-c`);

      rows.push({
        title: fallbackTitle,
        hours: 20,
        certificatetype: "COMPLEMENTAR",
        fileUrl: `https://drive.google.com/file/d/${baseSlug}/view`,
        fileId: baseSlug,
        status: "PENDING",
        feedback: null,
        userId: student.id,
        aiStatus: "QUEUED",
        aiSuggestedTitle: null,
        aiSuggestedHours: null,
        aiFeedback: null,
        createdAt,
        updatedAt: createdAt,
        aiDecision: "PENDING",
        aiRaw: null,
      });
    }

    if (!isReviewedOnlyStudent && !hasPendingExtensao) {
      const fallbackTitle = randomFrom(CERTIFICATE_TITLES);
      const createdAt = new Date(Date.now() - 3 * DAY);
      const baseSlug = slugify(`${student.email}-${fallbackTitle}-pending-e`);

      rows.push({
        title: fallbackTitle,
        hours: 20,
        certificatetype: "EXTENSAO",
        fileUrl: `https://drive.google.com/file/d/${baseSlug}/view`,
        fileId: baseSlug,
        status: "PENDING",
        feedback: null,
        userId: student.id,
        aiStatus: "QUEUED",
        aiSuggestedTitle: null,
        aiSuggestedHours: null,
        aiFeedback: null,
        createdAt,
        updatedAt: createdAt,
        aiDecision: "PENDING",
        aiRaw: null,
      });
    }
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await prisma.certificate.createMany({
      data: rows.slice(i, i + BATCH_SIZE),
    });
  }

  return rows.length;
}

async function cleanSeededData() {
  await prisma.certificate.deleteMany({
    where: {
      OR: [
        { user: { email: { startsWith: "aluno" } } },
        { user: { email: { startsWith: "pendente.solicitacao" } } },
        { user: { email: { startsWith: "solicitacao.rejeitada" } } },
        { user: { email: FIRST_ADMIN_EMAIL } },
        { user: { email: "admin@ufsj.edu.br" } },
        { user: { email: "coordenacao@ufsj.edu.br" } },
      ],
    },
  });

  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { startsWith: "aluno" } },
        { email: { startsWith: "pendente.solicitacao" } },
        { email: { startsWith: "solicitacao.rejeitada" } },
        { email: FIRST_ADMIN_EMAIL },
        { email: "admin@ufsj.edu.br" },
        { email: "coordenacao@ufsj.edu.br" },
      ],
    },
  });
}

export async function seed() {
  if (!Number.isFinite(TOTAL_STUDENTS) || TOTAL_STUDENTS <= 0) {
    throw new Error("SEED_STUDENTS must be a positive number");
  }

  if (
    !Number.isFinite(CERTIFICATES_PER_STUDENT) ||
    CERTIFICATES_PER_STUDENT <= 0
  ) {
    throw new Error("SEED_CERTIFICATES_PER_STUDENT must be a positive number");
  }

  if (!Number.isFinite(BATCH_SIZE) || BATCH_SIZE <= 0) {
    throw new Error("SEED_BATCH_SIZE must be a positive number");
  }

  if (RESET_DATA) {
    await cleanSeededData();
  }

  await createBaseUsers();
  const students = await createStudents(TOTAL_STUDENTS);
  const certificatesTotal = await createCertificates(
    students,
    CERTIFICATES_PER_STUDENT,
  );

  console.log("Seed finished:");
  console.log(`- students: ${students.length}`);
  console.log(`- certificates: ${certificatesTotal}`);
  console.log(`- batch size: ${BATCH_SIZE}`);
  console.log(`- first admin: ${FIRST_ADMIN_EMAIL}`);
}

seed()
  .catch((error) => {
    console.error("Erro ao executar seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
