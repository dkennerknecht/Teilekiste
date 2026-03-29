import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getCustomFieldPreset } from "@/lib/custom-field-presets";
import { createUniqueCustomFieldKey, findConflictingCustomField, serializeCustomFieldValueCatalog } from "@/lib/custom-fields";
import { parseJson } from "@/lib/http";
import { customFieldPresetApplySchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, customFieldPresetApplySchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof customFieldPresetApplySchema.parse>;

  const preset = getCustomFieldPreset(body.presetKey);
  if (!preset) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }

  const categoryId = body.categoryId;
  const typeId = body.typeId || null;
  const created: string[] = [];
  const skipped: string[] = [];

  const fields = await prisma.$transaction(async (tx) => {
    const createdFields = [];

    for (const presetField of preset.fields) {
      const conflict = await findConflictingCustomField(tx, {
        name: presetField.name,
        categoryId,
        typeId
      });

      if (conflict) {
        skipped.push(presetField.name);
        continue;
      }

      const key = await createUniqueCustomFieldKey(tx, presetField.name);
      const field = await tx.customField.create({
        data: {
          name: presetField.name,
          key,
          type: presetField.type,
          unit: presetField.unit || null,
          valueCatalog: serializeCustomFieldValueCatalog(presetField.valueCatalog || null),
          sortOrder: presetField.sortOrder,
          required: !!presetField.required,
          categoryId,
          typeId
        },
        include: {
          category: true,
          labelType: {
            select: { id: true, name: true, code: true }
          }
        }
      });
      created.push(presetField.name);
      createdFields.push(field);
    }

    return createdFields;
  });

  return NextResponse.json({
    preset: { key: preset.key, name: preset.name },
    created,
    skipped,
    fields
  });
}
