PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labelCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "typeId" TEXT,
    "storageLocationId" TEXT NOT NULL,
    "storageArea" TEXT,
    "bin" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
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
    CONSTRAINT "Item_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Item_mergedIntoItemId_fkey" FOREIGN KEY ("mergedIntoItemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

WITH "config" AS (
    SELECT
        COALESCE("separator", '-') AS "separator",
        COALESCE("prefix", '') AS "prefix",
        COALESCE("suffix", '') AS "suffix"
    FROM "LabelConfig"
    WHERE "id" = 'default'
    UNION ALL
    SELECT '-', '', ''
    WHERE NOT EXISTS (
        SELECT 1
        FROM "LabelConfig"
        WHERE "id" = 'default'
    )
),
"prepared" AS (
    SELECT
        "Item"."id",
        "Item"."labelCode",
        CASE
            WHEN "config"."prefix" <> '' AND substr("Item"."labelCode", 1, length("config"."prefix")) = "config"."prefix"
                THEN substr("Item"."labelCode", length("config"."prefix") + 1)
            ELSE "Item"."labelCode"
        END AS "withoutPrefix",
        "config"."separator",
        "config"."suffix"
    FROM "Item"
    CROSS JOIN "config"
),
"trimmed" AS (
    SELECT
        "prepared"."id",
        "prepared"."separator",
        CASE
            WHEN "prepared"."suffix" <> ''
                AND length("prepared"."withoutPrefix") >= length("prepared"."suffix")
                AND substr("prepared"."withoutPrefix", length("prepared"."withoutPrefix") - length("prepared"."suffix") + 1) = "prepared"."suffix"
                THEN substr("prepared"."withoutPrefix", 1, length("prepared"."withoutPrefix") - length("prepared"."suffix"))
            ELSE "prepared"."withoutPrefix"
        END AS "core"
    FROM "prepared"
),
"parsed" AS (
    SELECT
        "trimmed"."id",
        CASE
            WHEN instr("trimmed"."core", "trimmed"."separator") > 0
                AND instr(substr("trimmed"."core", instr("trimmed"."core", "trimmed"."separator") + length("trimmed"."separator")), "trimmed"."separator") > 0
                THEN substr(
                    substr("trimmed"."core", instr("trimmed"."core", "trimmed"."separator") + length("trimmed"."separator")),
                    1,
                    instr(substr("trimmed"."core", instr("trimmed"."core", "trimmed"."separator") + length("trimmed"."separator")), "trimmed"."separator") - 1
                )
            ELSE NULL
        END AS "typeCode"
    FROM "trimmed"
),
"uniqueTypeCodes" AS (
    SELECT
        "code",
        MIN("id") AS "id"
    FROM "LabelType"
    GROUP BY "code"
    HAVING COUNT(*) = 1
)
INSERT INTO "new_Item" (
    "id",
    "labelCode",
    "name",
    "description",
    "categoryId",
    "typeId",
    "storageLocationId",
    "storageArea",
    "bin",
    "stock",
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
    "Item"."id",
    "Item"."labelCode",
    "Item"."name",
    "Item"."description",
    "Item"."categoryId",
    "uniqueTypeCodes"."id",
    "Item"."storageLocationId",
    "Item"."storageArea",
    "Item"."bin",
    "Item"."stock",
    "Item"."unit",
    "Item"."minStock",
    "Item"."manufacturer",
    "Item"."mpn",
    "Item"."datasheetUrl",
    "Item"."purchaseUrl",
    "Item"."isArchived",
    "Item"."deletedAt",
    NULL,
    NULL,
    "Item"."createdAt",
    "Item"."updatedAt"
FROM "Item"
LEFT JOIN "parsed" ON "parsed"."id" = "Item"."id"
LEFT JOIN "uniqueTypeCodes" ON "uniqueTypeCodes"."code" = "parsed"."typeCode";

DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";

CREATE UNIQUE INDEX "Item_labelCode_key" ON "Item"("labelCode");
CREATE INDEX "Item_name_idx" ON "Item"("name");
CREATE INDEX "Item_labelCode_idx" ON "Item"("labelCode");
CREATE INDEX "Item_mpn_idx" ON "Item"("mpn");
CREATE INDEX "Item_manufacturer_idx" ON "Item"("manufacturer");
CREATE INDEX "Item_typeId_idx" ON "Item"("typeId");
CREATE INDEX "Item_storageLocationId_idx" ON "Item"("storageLocationId");
CREATE INDEX "Item_deletedAt_idx" ON "Item"("deletedAt");
CREATE INDEX "Item_mergedIntoItemId_idx" ON "Item"("mergedIntoItemId");
CREATE INDEX "Item_minStock_stock_idx" ON "Item"("minStock", "stock");

PRAGMA foreign_keys=ON;
