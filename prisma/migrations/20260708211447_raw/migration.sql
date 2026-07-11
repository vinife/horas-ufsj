/*
  Warnings:

  - The `aiRaw` column on the `Certificate` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Certificate" ALTER COLUMN "aiFeedback" SET DATA TYPE TEXT,
DROP COLUMN "aiRaw",
ADD COLUMN     "aiRaw" JSONB;
