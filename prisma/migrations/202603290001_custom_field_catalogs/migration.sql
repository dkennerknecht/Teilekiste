PRAGMA foreign_keys=OFF;

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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomField_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomField_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "LabelType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    CASE
        WHEN "options" IS NOT NULL AND json_valid("options") AND json_type("options") = 'array' THEN (
            SELECT json_group_array(
                json_object(
                    'value', json_each.value,
                    'aliases', json('[]'),
                    'sortOrder', CAST(json_each.key AS INTEGER)
                )
            )
            FROM json_each("CustomField"."options")
        )
        ELSE NULL
    END,
    0,
    "required",
    "categoryId",
    "typeId",
    "isActive",
    "createdAt",
    "updatedAt"
FROM "CustomField";

DROP TABLE "CustomField";
ALTER TABLE "new_CustomField" RENAME TO "CustomField";

CREATE UNIQUE INDEX "CustomField_key_key" ON "CustomField"("key");
CREATE UNIQUE INDEX "CustomField_name_categoryId_typeId_key" ON "CustomField"("name", "categoryId", "typeId");
CREATE INDEX "CustomField_typeId_idx" ON "CustomField"("typeId");

PRAGMA foreign_keys=ON;
