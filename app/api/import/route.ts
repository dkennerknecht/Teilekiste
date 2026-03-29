import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { requireWriteAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assignNextLabelCode } from "@/lib/label-code";
import { auditLog } from "@/lib/audit";
import { analyzeImportRows } from "@/lib/import-items";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { CustomFieldValidationError, prepareCustomFieldValueWrites } from "@/lib/custom-fields";

export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const form = await req.formData();
  const file = form.get("file");
  const dryRun = String(form.get("dryRun") || "1") !== "0";
  const typeId = String(form.get("typeId") || "");

  if (!(file instanceof File)) return NextResponse.json({ error: "CSV file missing" }, { status: 400 });
  if (!dryRun && !typeId) {
    return NextResponse.json({ error: "typeId required when dryRun=0" }, { status: 400 });
  }
  if (!dryRun) {
    const type = await prisma.labelType.findUnique({ where: { id: typeId } });
    if (!type) {
      return NextResponse.json({ error: "Invalid type selection" }, { status: 400 });
    }
  }
  const text = await file.text();
  const rows = parse(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[];

  const categories = await prisma.category.findMany();
  const locations = await prisma.storageLocation.findMany();
  const customFields = await prisma.customField.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      key: true,
      type: true,
      unit: true,
      options: true,
      valueCatalog: true,
      sortOrder: true,
      required: true,
      isActive: true,
      categoryId: true,
      typeId: true
    }
  });
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const locationMap = new Map(locations.map((l) => [l.name.toLowerCase(), l.id]));

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const duplicateValues = rows.flatMap((row) => [
    String(row.name || "").trim().toLowerCase(),
    String(row.mpn || "").trim().toLowerCase()
  ]).filter(Boolean);

  const duplicateCandidates = duplicateValues.length
    ? await prisma.item.findMany({
        where: {
          deletedAt: null,
          isArchived: false,
          OR: duplicateValues.flatMap((value) => [
            { name: { equals: value } },
            { mpn: { equals: value } }
          ]) as never
        },
        select: { id: true, labelCode: true, name: true, mpn: true }
      })
    : [];

  const duplicateCandidatesByKey = new Map<string, Array<{ id: string; labelCode: string; name: string }>>();
  for (const candidate of duplicateCandidates) {
    for (const key of [candidate.name, candidate.mpn].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)) {
      const entries = duplicateCandidatesByKey.get(key) || [];
      entries.push({ id: candidate.id, labelCode: candidate.labelCode, name: candidate.name });
      duplicateCandidatesByKey.set(key, entries);
    }
  }

  const report = analyzeImportRows({
    rows,
    categoryMap,
    locationMap,
    allowedLocationIds,
    duplicateCandidatesByKey,
    customFields,
    typeId: typeId || null
  });

  const customFieldWritesByLine = new Map<number, Awaited<ReturnType<typeof prepareCustomFieldValueWrites>>>();
  if (typeId) {
    for (const row of report.analyzedRows) {
      if (row.status !== "ready" || !row.input) continue;

      try {
        customFieldWritesByLine.set(
          row.lineNumber,
          await prepareCustomFieldValueWrites(prisma, {
            rawValues: row.input.customValues,
            categoryId: row.input.categoryId,
            typeId
          })
        );
      } catch (error) {
        if (error instanceof CustomFieldValidationError) {
          row.status = "error";
          row.errors.push(error.message);
          continue;
        }
        throw error;
      }
    }
  }

  const readyRows: Array<{
    lineNumber: number;
    input: NonNullable<(typeof report.analyzedRows)[number]["input"]>;
    warnings: string[];
  }> = [];
  for (const row of report.analyzedRows) {
    if (row.status === "ready" && row.input) {
      readyRows.push({
        lineNumber: row.lineNumber,
        input: row.input,
        warnings: row.warnings
      });
    }
  }
  const errorsCount = report.analyzedRows.reduce((count, row) => count + row.errors.length, 0);
  const warningsCount = report.analyzedRows.reduce((count, row) => count + row.warnings.length, 0);

  if (!dryRun && report.analyzedRows.some((row) => row.status === "error")) {
    return NextResponse.json({
      dryRun,
      ok: false,
      totalRows: rows.length,
      created: 0,
      errorsCount,
      warningsCount,
      rows: report.analyzedRows
    }, { status: 400 });
  }

  let createdItems: Array<{ id: string; labelCode: string; name: string }> = [];
  if (!dryRun) {
    createdItems = await prisma.$transaction(async (tx) => {
      const created: Array<{ id: string; labelCode: string; name: string }> = [];

      for (const row of readyRows) {
        const labelCode = await assignNextLabelCode(row.input.categoryId, typeId, tx);
        const { customValues, ...itemInput } = row.input;
        const item = await tx.item.create({
          data: {
            labelCode,
            ...itemInput
          }
        });

        const preparedWrites =
          customFieldWritesByLine.get(row.lineNumber) ||
          (await prepareCustomFieldValueWrites(tx, {
            rawValues: customValues,
            categoryId: row.input.categoryId,
            typeId
          }));
        await Promise.all(
          preparedWrites.upserts.map((entry) =>
            tx.itemCustomFieldValue.upsert({
              where: { itemId_customFieldId: { itemId: item.id, customFieldId: entry.customFieldId } },
              update: { valueJson: entry.valueJson },
              create: { itemId: item.id, customFieldId: entry.customFieldId, valueJson: entry.valueJson }
            })
          )
        );

        if (row.input.stock !== 0) {
          await tx.stockMovement.create({
            data: {
              itemId: item.id,
              delta: row.input.stock,
              reason: "PURCHASE",
              note: `CSV Import Zeile ${row.lineNumber}`,
              userId: auth.user!.id
            }
          });
        }

        await auditLog({
          userId: auth.user!.id,
          action: "ITEM_CREATE",
          entity: "Item",
          entityId: item.id,
          after: item
        }, tx);

        created.push({ id: item.id, labelCode: item.labelCode, name: item.name });
      }

      return created;
    });
  }

  return NextResponse.json({
    dryRun,
    ok: true,
    totalRows: rows.length,
    created: createdItems.length,
    createdItems,
    errorsCount,
    warningsCount,
    rows: report.analyzedRows
  });
}
