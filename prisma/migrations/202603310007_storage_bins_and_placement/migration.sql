-- CreateTable
CREATE TABLE "StorageBin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "storageLocationId" TEXT NOT NULL,
    "storageArea" TEXT,
    "slotCount" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StorageBin_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labelCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "typeId" TEXT,
    "storageLocationId" TEXT,
    "storageArea" TEXT,
    "bin" TEXT,
    "storageBinId" TEXT,
    "binSlot" INTEGER,
    "placementStatus" TEXT NOT NULL DEFAULT 'PLACED',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "incomingQty" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'STK',
    "minStock" INTEGER,
    "manufacturer" TEXT,
    "mpn" TEXT,
    "datasheetUrl" TEXT,
    "purchaseUrl" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "mergedIntoItemId" TEXT,
    "mergedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Item_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "LabelType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_storageBinId_fkey" FOREIGN KEY ("storageBinId") REFERENCES "StorageBin" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_mergedIntoItemId_fkey" FOREIGN KEY ("mergedIntoItemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("bin", "categoryId", "createdAt", "datasheetUrl", "deletedAt", "description", "id", "isArchived", "labelCode", "manufacturer", "mergedAt", "mergedIntoItemId", "minStock", "mpn", "name", "purchaseUrl", "stock", "storageArea", "storageLocationId", "typeId", "unit", "updatedAt") SELECT "bin", "categoryId", "createdAt", "datasheetUrl", "deletedAt", "description", "id", "isArchived", "labelCode", "manufacturer", "mergedAt", "mergedIntoItemId", "minStock", "mpn", "name", "purchaseUrl", "stock", "storageArea", "storageLocationId", "typeId", "unit", "updatedAt" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE UNIQUE INDEX "Item_labelCode_key" ON "Item"("labelCode");
CREATE INDEX "Item_name_idx" ON "Item"("name");
CREATE INDEX "Item_labelCode_idx" ON "Item"("labelCode");
CREATE INDEX "Item_mpn_idx" ON "Item"("mpn");
CREATE INDEX "Item_manufacturer_idx" ON "Item"("manufacturer");
CREATE INDEX "Item_typeId_idx" ON "Item"("typeId");
CREATE INDEX "Item_storageLocationId_idx" ON "Item"("storageLocationId");
CREATE INDEX "Item_storageBinId_idx" ON "Item"("storageBinId");
CREATE INDEX "Item_placementStatus_idx" ON "Item"("placementStatus");
CREATE INDEX "Item_storageBinId_binSlot_idx" ON "Item"("storageBinId", "binSlot");
CREATE INDEX "Item_deletedAt_idx" ON "Item"("deletedAt");
CREATE INDEX "Item_mergedIntoItemId_idx" ON "Item"("mergedIntoItemId");
CREATE INDEX "Item_minStock_stock_idx" ON "Item"("minStock", "stock");
CREATE UNIQUE INDEX "Item_storageBinId_binSlot_key" ON "Item"("storageBinId", "binSlot");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StorageBin_code_key" ON "StorageBin"("code");

-- CreateIndex
CREATE INDEX "StorageBin_storageLocationId_storageArea_idx" ON "StorageBin"("storageLocationId", "storageArea");
