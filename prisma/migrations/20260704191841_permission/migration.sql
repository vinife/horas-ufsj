-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canManageComplementar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageExtensao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageUsers" BOOLEAN NOT NULL DEFAULT false;
