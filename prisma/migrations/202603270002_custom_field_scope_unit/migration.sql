PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CustomField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "unit" TEXT,
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "typeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomField_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomField_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "LabelType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_CustomField" ("id", "name", "key", "type", "options", "required", "categoryId", "isActive", "createdAt", "updatedAt")
SELECT "id", "name", "key", "type", "options", "required", "categoryId", "isActive", "createdAt", "updatedAt"
FROM "CustomField";

DROP TABLE "CustomField";
ALTER TABLE "new_CustomField" RENAME TO "CustomField";

CREATE UNIQUE INDEX "CustomField_key_key" ON "CustomField"("key");
CREATE UNIQUE INDEX "CustomField_name_categoryId_typeId_key" ON "CustomField"("name", "categoryId", "typeId");
CREATE INDEX "CustomField_typeId_idx" ON "CustomField"("typeId");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
