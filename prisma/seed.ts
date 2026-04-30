import { db as prisma } from "../lib/db";

const TOTAL_STUDENTS = Number(process.env.SEED_STUDENTS ?? 120);
const CERTIFICATES_PER_STUDENT = Number(
  process.env.SEED_CERTIFICATES_PER_STUDENT ?? 18,
);
const BATCH_SIZE = Number(process.env.SEED_BATCH_SIZE ?? 400);
const RESET_DATA = (process.env.SEED_RESET ?? "true").toLowerCase() === "true";

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

const CERTIFICATE_TYPES = ["COMPLEMENTAR", "EXTENSÃO"] as const;
const STATUS_POOL = ["PENDING", "APPROVED", "REJECTED"] as const;
const STATUS_WEIGHTS = [55, 35, 10];

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
  const admin = await prisma.user.upsert({
    where: { email: "admin@ufsj.edu.br" },
    update: { name: "Admin UFSJ", role: "ADMIN", accessStatus: "APPROVED" },
    create: {
      name: "Admin UFSJ",
      email: "admin@ufsj.edu.br",
      role: "ADMIN",
      accessStatus: "APPROVED",
    },
  });

  const reviewer = await prisma.user.upsert({
    where: { email: "coordenacao@ufsj.edu.br" },
    update: {
      name: "Coordenacao UFSJ",
      role: "ADMIN",
      accessStatus: "APPROVED",
    },
    create: {
      name: "Coordenacao UFSJ",
      email: "coordenacao@ufsj.edu.br",
      role: "ADMIN",
      accessStatus: "APPROVED",
    },
  });

  return [admin, reviewer];
}

async function createStudents(total: number) {
  const students: { id: string; email: string; name: string }[] = [];

  for (let i = 1; i <= total; i += 1) {
    const name = `Aluno ${String(i).padStart(4, "0")}`;
    const email = `aluno${String(i).padStart(4, "0")}@ufsj.edu.br`;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, role: "STUDENT", accessStatus: "APPROVED" },
      create: { name, email, role: "STUDENT", accessStatus: "APPROVED" },
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

async function createCertificates(
  students: { id: string; email: string; name: string }[],
  perStudent: number,
) {
  const rows: {
    title: string;
    hours: number;
    certificatetype: (typeof CERTIFICATE_TYPES)[number];
    fileUrl: string;
    fileId: string;
    status: (typeof STATUS_POOL)[number];
    feedback: string | null;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];

  for (const student of students) {
    for (let i = 1; i <= perStudent; i += 1) {
      const title = randomFrom(CERTIFICATE_TITLES);
      const createdAt = randomDateInLastMonths(24);
      const updatedAt = new Date(
        createdAt.getTime() + Math.floor(Math.random() * 10) * 86400000,
      );
      const status = weightedStatus();
      const type = randomFrom(CERTIFICATE_TYPES);
      const baseSlug = slugify(`${student.email}-${title}-${i}`);

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
        createdAt,
        updatedAt,
      });
    }
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await prisma.certificate.createMany({ data: chunk });
  }

  return rows.length;
}

async function cleanSeededData() {
  await prisma.certificate.deleteMany({
    where: {
      OR: [
        { user: { email: { startsWith: "aluno" } } },
        { user: { email: "admin@ufsj.edu.br" } },
        { user: { email: "coordenacao@ufsj.edu.br" } },
      ],
    },
  });

  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { startsWith: "aluno" } },
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
}

seed()
  .catch((error) => {
    console.error("Erro ao executar seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
