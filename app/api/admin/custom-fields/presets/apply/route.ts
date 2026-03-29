import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getCustomFieldPreset } from "@/lib/custom-field-presets";
import { parseJson } from "@/lib/http";
import { customFieldPresetApplySchema } from "@/lib/validation";
import { syncTechnicalFieldScopeAssignment, TechnicalFieldAssignmentError } from "@/lib/technical-field-assignments";

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

  try {
    const result = await prisma.$transaction((tx) =>
      syncTechnicalFieldScopeAssignment(tx, {
        categoryId: body.categoryId,
        typeId: body.typeId,
        presetKey: body.presetKey
      })
    );

    return NextResponse.json({
      preset: { key: preset.key, name: preset.name },
      assignment: result.assignment,
      created: result.fields.filter((field) => result.createdFieldIds.includes(field.id)).map((field) => field.name),
      reactivated: result.fields.filter((field) => result.reactivatedFieldIds.includes(field.id)).map((field) => field.name),
      deactivatedFieldIds: result.deactivatedFieldIds,
      fields: result.fields
    });
  } catch (error) {
    if (error instanceof TechnicalFieldAssignmentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
