import type { Prisma } from "@prisma/client";
import { assignNextLabelCode } from "@/lib/label-code";
import { auditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  buildImportPreview,
  loadImportReferenceData,
  serializeImportPreview
} from "@/lib/import-items";
import { prepareCustomFieldValueWrites } from "@/lib/custom-fields";
import { parseImportProfileMappingConfig } from "@/lib/import-profiles";

type ImportWorkflowUser = {
  id: string;
};

function parseMappingDraft(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== "string" || !rawValue.trim()) return { assignments: [] };
  try {
    return parseImportProfileMappingConfig(JSON.parse(rawValue));
  } catch {
    return { assignments: [] };
  }
}

async function parseImportForm(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File)) {
    return { error: "CSV file missing" } as const;
  }

  const text = await file.text();
  return {
    text,
    selectedProfileId: String(form.get("profileId") || "").trim() || null,
    mappingDraft: parseMappingDraft(form.get("mappingDraft")),
    forcedTypeId: String(form.get("typeId") || "").trim() || null
  } as const;
}

export async function runImportPreviewWorkflow(input: {
  form: FormData;
  allowedLocationIds: string[] | null;
}) {
  const parsedForm = await parseImportForm(input.form);
  if ("error" in parsedForm) {
    return {
      status: 400,
      body: { error: parsedForm.error }
    };
  }

  const referenceData = await loadImportReferenceData(prisma);
  const preview = await buildImportPreview({
    db: prisma,
    text: parsedForm.text,
    allowedLocationIds: input.allowedLocationIds,
    ...referenceData,
    selectedProfileId: parsedForm.selectedProfileId,
    mappingDraft: parsedForm.mappingDraft,
    forcedTypeId: parsedForm.forcedTypeId
  });

  return {
    status: 200,
    body: {
      ok: preview.mappingIssues.length === 0 && !preview.rows.some((row) => row.status === "error"),
      ...serializeImportPreview(preview)
    }
  };
}

export async function runImportApplyWorkflow(input: {
  form: FormData;
  allowedLocationIds: string[] | null;
  user: ImportWorkflowUser;
}) {
  const parsedForm = await parseImportForm(input.form);
  if ("error" in parsedForm) {
    return {
      status: 400,
      body: { error: parsedForm.error }
    };
  }

  const referenceData = await loadImportReferenceData(prisma);
  const preview = await buildImportPreview({
    db: prisma,
    text: parsedForm.text,
    allowedLocationIds: input.allowedLocationIds,
    ...referenceData,
    selectedProfileId: parsedForm.selectedProfileId,
    mappingDraft: parsedForm.mappingDraft,
    forcedTypeId: parsedForm.forcedTypeId
  });

  const serializedPreview = serializeImportPreview(preview);
  if (preview.mappingIssues.length || preview.rows.some((row) => row.status === "error")) {
    return {
      status: 400,
      body: {
        ok: false,
        created: 0,
        createdItems: [],
        ...serializedPreview
      }
    };
  }

  const createdItems = await prisma.$transaction(async (tx) => {
    const created: Array<{ id: string; labelCode: string; name: string }> = [];

    for (const row of preview.preparedRows) {
      const labelCode = await assignNextLabelCode(row.itemInput.categoryId, row.itemInput.typeId, tx);
      const { tagIds: _tagIds, customValues: _customValues, ...itemData } = row.itemInput;
      const item = await tx.item.create({
        data: {
          labelCode,
          ...itemData
        }
      });

      const preparedCustomValues = await prepareCustomFieldValueWrites(tx as Prisma.TransactionClient, {
        rawValues: row.rawCustomValues,
        categoryId: row.itemInput.categoryId,
        typeId: row.itemInput.typeId
      });

      await Promise.all(
        preparedCustomValues.upserts.map((entry) =>
          tx.itemCustomFieldValue.upsert({
            where: {
              itemId_customFieldId: {
                itemId: item.id,
                customFieldId: entry.customFieldId
              }
            },
            update: { valueJson: entry.valueJson },
            create: {
              itemId: item.id,
              customFieldId: entry.customFieldId,
              valueJson: entry.valueJson
            }
          })
        )
      );

      if (row.itemInput.stock !== 0) {
        await tx.stockMovement.create({
          data: {
            itemId: item.id,
            delta: row.itemInput.stock,
            reason: "PURCHASE",
            note: `CSV Import Zeile ${row.lineNumber}`,
            userId: input.user.id
          }
        });
      }

      await auditLog(
        {
          userId: input.user.id,
          action: "ITEM_CREATE",
          entity: "Item",
          entityId: item.id,
          after: item
        },
        tx as Prisma.TransactionClient
      );

      created.push({
        id: item.id,
        labelCode: item.labelCode,
        name: item.name
      });
    }

    return created;
  });

  return {
    status: 200,
    body: {
      ok: true,
      created: createdItems.length,
      createdItems,
      ...serializedPreview
    }
  };
}
