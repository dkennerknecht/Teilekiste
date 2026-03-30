CREATE TABLE "InventorySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "storageLocationId" TEXT NOT NULL,
    "storageArea" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "finalizedAt" DATETIME,
    "cancelledAt" DATETIME,
    CONSTRAINT "InventorySession_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventorySession_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventorySession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "InventorySessionRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "labelCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "storageArea" TEXT,
    "bin" TEXT,
    "expectedStock" INTEGER NOT NULL,
    "countedStock" INTEGER,
    "countedByUserId" TEXT,
    "countedAt" DATETIME,
    "note" TEXT,
    CONSTRAINT "InventorySessionRow_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InventorySession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventorySessionRow_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventorySessionRow_countedByUserId_fkey" FOREIGN KEY ("countedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "StockMovement" ADD COLUMN "inventorySessionId" TEXT REFERENCES "InventorySession" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "StockMovement_inventorySessionId_idx" ON "StockMovement"("inventorySessionId");
CREATE INDEX "InventorySession_storageLocationId_status_idx" ON "InventorySession"("storageLocationId", "status");
CREATE INDEX "InventorySession_ownerUserId_status_idx" ON "InventorySession"("ownerUserId", "status");
CREATE INDEX "InventorySession_createdByUserId_idx" ON "InventorySession"("createdByUserId");
CREATE UNIQUE INDEX "InventorySession_open_storageLocationId_key" ON "InventorySession"("storageLocationId") WHERE "status" = 'OPEN';
CREATE UNIQUE INDEX "InventorySessionRow_sessionId_itemId_key" ON "InventorySessionRow"("sessionId", "itemId");
CREATE INDEX "InventorySessionRow_itemId_idx" ON "InventorySessionRow"("itemId");
CREATE INDEX "InventorySessionRow_countedByUserId_idx" ON "InventorySessionRow"("countedByUserId");
