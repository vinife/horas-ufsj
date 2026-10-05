-- CreateEnum
CREATE TYPE "ExtensionProjectStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'COMPLETED');

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "extensionProjectId" TEXT;

-- CreateTable
CREATE TABLE "ExtensionProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coordinatorName" TEXT NOT NULL,
    "coordinatorEmail" TEXT NOT NULL,
    "coordinatorInstitution" TEXT NOT NULL,
    "workPlan" TEXT NOT NULL,
    "status" "ExtensionProjectStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_extensionProjectId_key" ON "Certificate"("extensionProjectId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_extensionProjectId_fkey" FOREIGN KEY ("extensionProjectId") REFERENCES "ExtensionProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtensionProject" ADD CONSTRAINT "ExtensionProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
