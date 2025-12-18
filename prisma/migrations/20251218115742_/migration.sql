/*
  Warnings:

  - You are about to drop the column `avatar` on the `Keys` table. All the data in the column will be lost.
  - You are about to drop the column `enckey` on the `Keys` table. All the data in the column will be lost.
  - You are about to drop the column `localKey` on the `Keys` table. All the data in the column will be lost.
  - You are about to drop the column `nip05` on the `Keys` table. All the data in the column will be lost.
  - You are about to drop the column `nsec` on the `Keys` table. All the data in the column will be lost.
  - You are about to drop the column `profile` on the `Keys` table. All the data in the column will be lost.
  - You are about to drop the `Apps` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `History` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Pending` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Perms` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SyncHistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Keys" DROP COLUMN "avatar",
DROP COLUMN "enckey",
DROP COLUMN "localKey",
DROP COLUMN "nip05",
DROP COLUMN "nsec",
DROP COLUMN "profile";

-- DropTable
DROP TABLE "Apps";

-- DropTable
DROP TABLE "History";

-- DropTable
DROP TABLE "Pending";

-- DropTable
DROP TABLE "Perms";

-- DropTable
DROP TABLE "SyncHistory";
