/*
  Warnings:

  - Added the required column `enckey` to the `Keys` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Keys" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "enckey" TEXT NOT NULL,
ADD COLUMN     "localKey" JSONB,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "ncryptsec" TEXT,
ADD COLUMN     "profile" JSONB,
ADD COLUMN     "relays" TEXT[];
