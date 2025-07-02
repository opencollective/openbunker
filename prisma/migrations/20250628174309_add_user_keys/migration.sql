/*
  Warnings:

  - You are about to drop the column `jsonData` on the `Apps` table. All the data in the column will be lost.
  - You are about to drop the column `jsonData` on the `History` table. All the data in the column will be lost.
  - You are about to drop the column `jsonData` on the `Keys` table. All the data in the column will be lost.
  - You are about to drop the column `jsonData` on the `Pending` table. All the data in the column will be lost.
  - Added the required column `icon` to the `Apps` table without a default value. This is not possible if the table is not empty.
  - Added the required column `permUpdateTimestamp` to the `Apps` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updateTimestamp` to the `Apps` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Apps` table without a default value. This is not possible if the table is not empty.
  - Added the required column `params` to the `Pending` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Apps" DROP COLUMN "jsonData",
ADD COLUMN     "icon" TEXT NOT NULL,
ADD COLUMN     "permUpdateTimestamp" BIGINT NOT NULL,
ADD COLUMN     "subNpub" TEXT,
ADD COLUMN     "token" TEXT,
ADD COLUMN     "updateTimestamp" BIGINT NOT NULL,
ADD COLUMN     "url" TEXT NOT NULL,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "History" DROP COLUMN "jsonData",
ADD COLUMN     "params" TEXT;

-- AlterTable
ALTER TABLE "Keys" DROP COLUMN "jsonData",
ADD COLUMN     "nip05" TEXT,
ALTER COLUMN "localKey" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Pending" DROP COLUMN "jsonData",
ADD COLUMN     "appIcon" TEXT,
ADD COLUMN     "appName" TEXT,
ADD COLUMN     "appUrl" TEXT,
ADD COLUMN     "params" TEXT NOT NULL,
ADD COLUMN     "subNpub" TEXT;

-- CreateTable
CREATE TABLE "UserKeys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "npub" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserKeys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserKeys_userId_idx" ON "UserKeys"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserKeys_userId_npub_key" ON "UserKeys"("userId", "npub");

-- AddForeignKey
ALTER TABLE "UserKeys" ADD CONSTRAINT "UserKeys_npub_fkey" FOREIGN KEY ("npub") REFERENCES "Keys"("npub") ON DELETE CASCADE ON UPDATE CASCADE;
