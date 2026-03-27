-- CreateTable
CREATE TABLE "StorageShelf" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storageLocationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StorageShelf_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageShelf_storageLocationId_name_key" ON "StorageShelf"("storageLocationId", "name");

-- CreateIndex
CREATE INDEX "StorageShelf_storageLocationId_idx" ON "StorageShelf"("storageLocationId");
