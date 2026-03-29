PRAGMA foreign_keys=OFF;

CREATE TABLE "TechnicalFieldScopeAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "presetKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TechnicalFieldScopeAssignment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TechnicalFieldScopeAssignment_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "LabelType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TechnicalFieldScopeAssignment_categoryId_typeId_key" ON "TechnicalFieldScopeAssignment"("categoryId", "typeId");
CREATE INDEX "TechnicalFieldScopeAssignment_typeId_idx" ON "TechnicalFieldScopeAssignment"("typeId");

CREATE TABLE "new_CustomField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "unit" TEXT,
    "options" TEXT,
    "valueCatalog" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "typeId" TEXT,
    "technicalFieldScopeAssignmentId" TEXT,
    "managedPresetKey" TEXT,
    "managedPresetFieldKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomField_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomField_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "LabelType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomField_technicalFieldScopeAssignmentId_fkey" FOREIGN KEY ("technicalFieldScopeAssignmentId") REFERENCES "TechnicalFieldScopeAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_CustomField" (
    "id",
    "name",
    "key",
    "type",
    "unit",
    "options",
    "valueCatalog",
    "sortOrder",
    "required",
    "categoryId",
    "typeId",
    "technicalFieldScopeAssignmentId",
    "managedPresetKey",
    "managedPresetFieldKey",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    "key",
    "type",
    "unit",
    "options",
    "valueCatalog",
    "sortOrder",
    "required",
    "categoryId",
    "typeId",
    NULL,
    NULL,
    NULL,
    "isActive",
    "createdAt",
    "updatedAt"
FROM "CustomField";

DROP TABLE "CustomField";
ALTER TABLE "new_CustomField" RENAME TO "CustomField";

CREATE UNIQUE INDEX "CustomField_key_key" ON "CustomField"("key");
CREATE UNIQUE INDEX "CustomField_name_categoryId_typeId_key" ON "CustomField"("name", "categoryId", "typeId");
CREATE INDEX "CustomField_typeId_idx" ON "CustomField"("typeId");
CREATE INDEX "CustomField_technicalFieldScopeAssignmentId_idx" ON "CustomField"("technicalFieldScopeAssignmentId");
CREATE INDEX "CustomField_managedPresetKey_managedPresetFieldKey_idx" ON "CustomField"("managedPresetKey", "managedPresetFieldKey");

PRAGMA foreign_keys=ON;
