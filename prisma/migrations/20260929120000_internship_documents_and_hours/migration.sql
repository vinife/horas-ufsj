-- CreateEnum
CREATE TYPE "InternshipDocumentKind" AS ENUM ('PARTIAL_REPORT', 'COMPLETION_TERM', 'FINAL_REPORT', 'TERMINATION_TERM');

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "internshipId" TEXT;

-- CreateTable
CREATE TABLE "InternshipDocument" (
    "id" TEXT NOT NULL,
    "internshipId" TEXT NOT NULL,
    "kind" "InternshipDocumentKind" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "InternshipDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_internshipId_key" ON "Certificate"("internshipId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipDocument" ADD CONSTRAINT "InternshipDocument_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
