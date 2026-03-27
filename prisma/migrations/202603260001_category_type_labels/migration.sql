-- AlterTable
ALTER TABLE "Category" ADD COLUMN "code" TEXT;

-- CreateTable
CREATE TABLE "CategoryTypeCounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CategoryTypeCounter_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CategoryTypeCounter_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "LabelType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CategoryTypeCounter_typeId_idx" ON "CategoryTypeCounter"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryTypeCounter_categoryId_typeId_key" ON "CategoryTypeCounter"("categoryId", "typeId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");
