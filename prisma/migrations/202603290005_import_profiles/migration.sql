-- CreateTable
CREATE TABLE "ImportProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "headerFingerprint" TEXT,
    "delimiterMode" TEXT NOT NULL DEFAULT 'AUTO',
    "mappingConfig" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportProfile_name_key" ON "ImportProfile"("name");

-- CreateIndex
CREATE INDEX "ImportProfile_headerFingerprint_idx" ON "ImportProfile"("headerFingerprint");
