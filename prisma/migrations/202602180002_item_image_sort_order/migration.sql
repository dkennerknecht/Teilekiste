ALTER TABLE "ItemImage" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, itemId, ROW_NUMBER() OVER (PARTITION BY itemId ORDER BY createdAt ASC) - 1 AS pos
  FROM "ItemImage"
)
UPDATE "ItemImage"
SET "sortOrder" = (
  SELECT pos FROM ranked WHERE ranked.id = "ItemImage".id
);

UPDATE "ItemImage"
SET "isPrimary" = CASE
  WHEN id IN (
    SELECT id FROM "ItemImage" i2
    WHERE i2.itemId = "ItemImage".itemId
    ORDER BY i2.sortOrder ASC, i2.createdAt ASC
    LIMIT 1
  ) THEN 1 ELSE 0 END;

CREATE INDEX "ItemImage_itemId_sortOrder_idx" ON "ItemImage"("itemId", "sortOrder");
