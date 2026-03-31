ALTER TABLE "StorageShelf" ADD COLUMN "code" TEXT;
ALTER TABLE "StorageShelf" ADD COLUMN "description" TEXT;
ALTER TABLE "StorageShelf" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'OPEN_AREA';

UPDATE "StorageShelf"
SET "description" = COALESCE("description", "name");

UPDATE "StorageShelf"
SET "mode" = 'DRAWER_HOST'
WHERE EXISTS (
  SELECT 1
  FROM "StorageBin"
  WHERE "StorageBin"."storageLocationId" = "StorageShelf"."storageLocationId"
    AND COALESCE("StorageBin"."storageArea", '') = COALESCE("StorageShelf"."name", '')
);

INSERT INTO "StorageShelf" (
  "id",
  "storageLocationId",
  "name",
  "code",
  "description",
  "mode",
  "createdAt",
  "updatedAt"
)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
  source."storageLocationId",
  source."shelfName",
  NULL,
  source."shelfName",
  'DRAWER_HOST',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT
    "storageLocationId",
    COALESCE("storageArea", 'Imported Drawer Area') AS "shelfName"
  FROM "StorageBin"
) AS source
WHERE NOT EXISTS (
  SELECT 1
  FROM "StorageShelf" shelf
  WHERE shelf."storageLocationId" = source."storageLocationId"
    AND shelf."name" = source."shelfName"
);

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_StorageBin" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "storageLocationId" TEXT NOT NULL,
  "storageShelfId" TEXT NOT NULL,
  "storageArea" TEXT,
  "slotCount" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StorageBin_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StorageBin_storageShelfId_fkey" FOREIGN KEY ("storageShelfId") REFERENCES "StorageShelf" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_StorageBin" (
  "id",
  "code",
  "storageLocationId",
  "storageShelfId",
  "storageArea",
  "slotCount",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  old."id",
  old."code",
  old."storageLocationId",
  COALESCE(
    (
      SELECT shelf."id"
      FROM "StorageShelf" shelf
      WHERE shelf."storageLocationId" = old."storageLocationId"
        AND shelf."name" = COALESCE(old."storageArea", 'Imported Drawer Area')
      LIMIT 1
    ),
    (
      SELECT shelf."id"
      FROM "StorageShelf" shelf
      WHERE shelf."storageLocationId" = old."storageLocationId"
      ORDER BY shelf."createdAt" ASC
      LIMIT 1
    )
  ),
  old."storageArea",
  old."slotCount",
  old."isActive",
  old."createdAt",
  old."updatedAt"
FROM "StorageBin" old;

DROP TABLE "StorageBin";
ALTER TABLE "new_StorageBin" RENAME TO "StorageBin";
CREATE INDEX "StorageBin_storageShelfId_idx" ON "StorageBin"("storageShelfId");
CREATE INDEX "StorageBin_storageLocationId_storageArea_idx" ON "StorageBin"("storageLocationId", "storageArea");
CREATE UNIQUE INDEX "StorageBin_storageShelfId_code_key" ON "StorageBin"("storageShelfId", "code");

CREATE TABLE "new_Item" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "labelCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "typeId" TEXT,
  "storageLocationId" TEXT,
  "storageShelfId" TEXT,
  "storageArea" TEXT,
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
  CONSTRAINT "Item_storageShelfId_fkey" FOREIGN KEY ("storageShelfId") REFERENCES "StorageShelf" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Item_storageBinId_fkey" FOREIGN KEY ("storageBinId") REFERENCES "StorageBin" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Item_mergedIntoItemId_fkey" FOREIGN KEY ("mergedIntoItemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Item" (
  "id",
  "labelCode",
  "name",
  "description",
  "categoryId",
  "typeId",
  "storageLocationId",
  "storageShelfId",
  "storageArea",
  "storageBinId",
  "binSlot",
  "placementStatus",
  "stock",
  "incomingQty",
  "unit",
  "minStock",
  "manufacturer",
  "mpn",
  "datasheetUrl",
  "purchaseUrl",
  "isArchived",
  "deletedAt",
  "mergedIntoItemId",
  "mergedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  old."id",
  old."labelCode",
  old."name",
  old."description",
  old."categoryId",
  old."typeId",
  old."storageLocationId",
  COALESCE(
    (
      SELECT bin."storageShelfId"
      FROM "StorageBin" bin
      WHERE bin."id" = old."storageBinId"
      LIMIT 1
    ),
    (
      SELECT shelf."id"
      FROM "StorageShelf" shelf
      WHERE shelf."storageLocationId" = old."storageLocationId"
        AND shelf."name" = old."storageArea"
      LIMIT 1
    )
  ),
  old."storageArea",
  old."storageBinId",
  old."binSlot",
  old."placementStatus",
  old."stock",
  old."incomingQty",
  old."unit",
  old."minStock",
  old."manufacturer",
  old."mpn",
  old."datasheetUrl",
  old."purchaseUrl",
  old."isArchived",
  old."deletedAt",
  old."mergedIntoItemId",
  old."mergedAt",
  old."createdAt",
  old."updatedAt"
FROM "Item" old;

DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE UNIQUE INDEX "Item_labelCode_key" ON "Item"("labelCode");
CREATE INDEX "Item_name_idx" ON "Item"("name");
CREATE INDEX "Item_labelCode_idx" ON "Item"("labelCode");
CREATE INDEX "Item_mpn_idx" ON "Item"("mpn");
CREATE INDEX "Item_manufacturer_idx" ON "Item"("manufacturer");
CREATE INDEX "Item_typeId_idx" ON "Item"("typeId");
CREATE INDEX "Item_storageLocationId_idx" ON "Item"("storageLocationId");
CREATE INDEX "Item_storageShelfId_idx" ON "Item"("storageShelfId");
CREATE INDEX "Item_storageBinId_idx" ON "Item"("storageBinId");
CREATE INDEX "Item_placementStatus_idx" ON "Item"("placementStatus");
CREATE INDEX "Item_storageBinId_binSlot_idx" ON "Item"("storageBinId", "binSlot");
CREATE INDEX "Item_deletedAt_idx" ON "Item"("deletedAt");
CREATE INDEX "Item_mergedIntoItemId_idx" ON "Item"("mergedIntoItemId");
CREATE INDEX "Item_minStock_stock_idx" ON "Item"("minStock", "stock");
CREATE UNIQUE INDEX "Item_storageBinId_binSlot_key" ON "Item"("storageBinId", "binSlot");

CREATE TABLE "new_InventorySessionRow" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "labelCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "storageArea" TEXT,
  "storageShelfCode" TEXT,
  "storageBinCode" TEXT,
  "binSlot" INTEGER,
  "expectedStock" INTEGER NOT NULL,
  "countedStock" INTEGER,
  "countedByUserId" TEXT,
  "countedAt" DATETIME,
  "note" TEXT,
  CONSTRAINT "InventorySessionRow_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InventorySession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventorySessionRow_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InventorySessionRow_countedByUserId_fkey" FOREIGN KEY ("countedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_InventorySessionRow" (
  "id",
  "sessionId",
  "itemId",
  "labelCode",
  "name",
  "unit",
  "storageArea",
  "storageShelfCode",
  "storageBinCode",
  "binSlot",
  "expectedStock",
  "countedStock",
  "countedByUserId",
  "countedAt",
  "note"
)
SELECT
  row."id",
  row."sessionId",
  row."itemId",
  row."labelCode",
  row."name",
  row."unit",
  row."storageArea",
  (
    SELECT shelf."code"
    FROM "StorageShelf" shelf
    JOIN "InventorySession" session ON session."id" = row."sessionId"
    WHERE shelf."storageLocationId" = session."storageLocationId"
      AND shelf."name" = row."storageArea"
    LIMIT 1
  ),
  row."bin",
  CASE
    WHEN row."bin" GLOB '*-[0-9]*' THEN CAST(substr(row."bin", instr(row."bin", '-') + 1) AS INTEGER)
    ELSE NULL
  END,
  row."expectedStock",
  row."countedStock",
  row."countedByUserId",
  row."countedAt",
  row."note"
FROM "InventorySessionRow" row;

DROP TABLE "InventorySessionRow";
ALTER TABLE "new_InventorySessionRow" RENAME TO "InventorySessionRow";
CREATE INDEX "InventorySessionRow_itemId_idx" ON "InventorySessionRow"("itemId");
CREATE INDEX "InventorySessionRow_countedByUserId_idx" ON "InventorySessionRow"("countedByUserId");
CREATE UNIQUE INDEX "InventorySessionRow_sessionId_itemId_key" ON "InventorySessionRow"("sessionId", "itemId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE UNIQUE INDEX "StorageShelf_storageLocationId_code_key" ON "StorageShelf"("storageLocationId", "code");
