-- CreateTable
CREATE TABLE "Keys" (
    "npub" TEXT NOT NULL,
    "jsonData" TEXT NOT NULL,

    CONSTRAINT "Keys_pkey" PRIMARY KEY ("npub")
);

-- CreateTable
CREATE TABLE "Apps" (
    "appNpub" TEXT NOT NULL,
    "npub" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "jsonData" TEXT NOT NULL,

    CONSTRAINT "Apps_pkey" PRIMARY KEY ("appNpub","npub")
);

-- CreateTable
CREATE TABLE "Perms" (
    "id" TEXT NOT NULL,
    "npub" TEXT NOT NULL,
    "appNpub" TEXT NOT NULL,
    "perm" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,

    CONSTRAINT "Perms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pending" (
    "id" TEXT NOT NULL,
    "npub" TEXT NOT NULL,
    "appNpub" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "method" TEXT NOT NULL,
    "jsonData" TEXT NOT NULL,

    CONSTRAINT "Pending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "History" (
    "id" TEXT NOT NULL,
    "npub" TEXT NOT NULL,
    "appNpub" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "method" TEXT NOT NULL,
    "allowed" BOOLEAN,
    "jsonData" TEXT NOT NULL,
    "result" TEXT,

    CONSTRAINT "History_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncHistory" (
    "npub" TEXT NOT NULL,

    CONSTRAINT "SyncHistory_pkey" PRIMARY KEY ("npub")
);

-- CreateTable
CREATE TABLE "ConnectTokens" (
    "token" TEXT NOT NULL,
    "npub" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "expiry" BIGINT NOT NULL,
    "subNpub" TEXT,
    "jsonData" TEXT NOT NULL,

    CONSTRAINT "ConnectTokens_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE INDEX "History_npub_appNpub_idx" ON "History"("npub", "appNpub");

-- CreateIndex
CREATE INDEX "ConnectTokens_npub_subNpub_idx" ON "ConnectTokens"("npub", "subNpub");
