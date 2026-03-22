ALTER TABLE "ItemImage" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "ItemImage_itemId_isPrimary_idx" ON "ItemImage"("itemId", "isPrimary");
