/*
  Warnings:

  - Added the required column `keyNpub` to the `Scopes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `owner` to the `Scopes` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Sessions" DROP CONSTRAINT "Sessions_scopeSlug_fkey";

-- AlterTable
ALTER TABLE "Keys" ADD COLUMN     "nsec" TEXT;

-- AlterTable
ALTER TABLE "Scopes" ADD COLUMN     "keyNpub" TEXT NOT NULL,
ADD COLUMN     "owner" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Keys_npub_idx" ON "Keys"("npub");

-- CreateIndex
CREATE INDEX "Scopes_owner_idx" ON "Scopes"("owner");

-- AddForeignKey
ALTER TABLE "Scopes" ADD CONSTRAINT "Scopes_keyNpub_fkey" FOREIGN KEY ("keyNpub") REFERENCES "Keys"("npub") ON DELETE CASCADE ON UPDATE CASCADE;
