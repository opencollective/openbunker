-- CreateTable
CREATE TABLE "Scopes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scopes_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Scopes_slug_key" ON "Scopes"("slug");

-- CreateTable
CREATE TABLE "Sessions" (
    "sessionNpub" TEXT NOT NULL,
    "npub" TEXT NOT NULL,
    "appNpub" TEXT,
    "scopeSlug" TEXT,
    "expiresAt" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sessions_pkey" PRIMARY KEY ("sessionNpub")
);

-- CreateIndex
CREATE INDEX "Scopes_slug_idx" ON "Scopes"("slug");

-- CreateIndex
CREATE INDEX "Sessions_npub_appNpub_idx" ON "Sessions"("npub", "appNpub");

-- AddForeignKey
ALTER TABLE "Sessions" ADD CONSTRAINT "Sessions_scopeSlug_fkey" FOREIGN KEY ("scopeSlug") REFERENCES "Scopes"("slug") ON DELETE SET NULL ON UPDATE CASCADE;
