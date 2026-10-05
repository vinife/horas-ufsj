-- CreateEnum
CREATE TYPE "InternshipStatus" AS ENUM ('PENDING', 'REJECTED', 'ACTIVE', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ComplementarHourType" AS ENUM ('INICIACAO_CIENTIFICA', 'MONITORIA', 'ESTAGIO_NAO_OBRIGATORIO_TRAINEE', 'CERTIFICACAO_LINGUA_ESTRANGEIRA', 'CURSO_IDIOMAS', 'CURSOS_LIVRES_CC', 'CERTIFICACAO_TECNOLOGIA_CC', 'GRUPO_ESTUDO_CC', 'PARTICIPACAO_EVENTOS', 'ORGANIZACAO_EVENTOS', 'PUBLICACAO_ARTIGO_COMPLETO', 'APRESENTACAO_ARTIGO_COMPLETO', 'APRESENTACAO_CURSO_CURTA_DURACAO', 'EQUIPE_COMPETICAO_UFSJ', 'COMPETICAO_EQUIPE_REGISTRADA_UFSJ', 'REPRESENTACAO_ESTUDANTIL', 'DIRETORIA_ATLETICA', 'PET_GET', 'COMPETICAO_ATLETICA', 'GESTAO_EMPRESA_JUNIOR', 'DOACAO_SANGUE');

-- CreateEnum
CREATE TYPE "InternshipSubmissionKind" AS ENUM ('INITIAL', 'EXTENSION');

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "complementarHourType" "ComplementarHourType";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canManageEstagio" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Internship" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "InternshipStatus" NOT NULL DEFAULT 'PENDING',
    "company" TEXT NOT NULL,
    "supervisor" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Internship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipSubmission" (
    "id" TEXT NOT NULL,
    "internshipId" TEXT NOT NULL,
    "kind" "InternshipSubmissionKind" NOT NULL DEFAULT 'INITIAL',
    "company" TEXT NOT NULL,
    "supervisor" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "InternshipSubmission_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Internship" ADD CONSTRAINT "Internship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipSubmission" ADD CONSTRAINT "InternshipSubmission_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
