-- AlterTable
ALTER TABLE "SystemConfig" ADD COLUMN     "complementarLimit" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "extensaoLimit" INTEGER NOT NULL DEFAULT 200;
