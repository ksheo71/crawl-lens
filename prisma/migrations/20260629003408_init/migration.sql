-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "fetchStatus" INTEGER,
    "totalScore" INTEGER,
    "categoryScores" JSONB,
    "checks" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scan_publicId_key" ON "Scan"("publicId");

-- CreateIndex
CREATE INDEX "Scan_publicId_idx" ON "Scan"("publicId");

-- CreateIndex
CREATE INDEX "Scan_createdAt_idx" ON "Scan"("createdAt");

-- CreateIndex
CREATE INDEX "Scan_ipHash_createdAt_idx" ON "Scan"("ipHash", "createdAt");
