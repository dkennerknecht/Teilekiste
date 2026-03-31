import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/http";
import {
  type CustomFieldPresetField,
  ensureTechnicalFieldPresets,
  parseTechnicalFieldPresetFields,
  serializeTechnicalFieldPresetFields
} from "@/lib/custom-field-presets";
import {
  technicalFieldPresetCreateSchema,
  technicalFieldPresetDeleteSchema,
  technicalFieldPresetUpdateSchema
} from "@/lib/validation";

async function buildPresetResponse() {
  await ensureTechnicalFieldPresets(prisma as any);

  const [presets, assignments] = await Promise.all([
    prisma.technicalFieldPreset.findMany({
      orderBy: [{ name: "asc" }, { key: "asc" }]
    }),
    prisma.technicalFieldScopeAssignment.findMany({
      select: { presetKey: true }
    })
  ]);

  const assignmentCounts = new Map<string, number>();
  for (const assignment of assignments) {
    assignmentCounts.set(assignment.presetKey, (assignmentCounts.get(assignment.presetKey) || 0) + 1);
  }

  return presets.map((preset: any) => ({
    id: preset.id,
    key: preset.key,
    name: preset.name,
    description: preset.description,
    fields: parseTechnicalFieldPresetFields(preset.fieldsJson),
    assignmentCount: assignmentCounts.get(preset.key) || 0,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt
  }));
}

function normalizePresetFields(fields: Array<Record<string, unknown>>): CustomFieldPresetField[] {
  return fields.map((field, index) => ({
    key: String(field.key || "").trim(),
    name: String(field.name || "").trim(),
    type: String(field.type || "TEXT") as CustomFieldPresetField["type"],
    unit: typeof field.unit === "string" ? field.unit.trim() || null : null,
    required: !!field.required,
    sortOrder: typeof field.sortOrder === "number" && Number.isFinite(field.sortOrder) ? field.sortOrder : index,
    valueCatalog: Array.isArray(field.valueCatalog)
      ? field.valueCatalog.map((entry, catalogIndex) => ({
          value: String((entry as any)?.value || "").trim(),
          aliases: Array.isArray((entry as any)?.aliases)
            ? (entry as any).aliases.map((alias: unknown) => String(alias || "").trim()).filter(Boolean)
            : [],
          sortOrder:
            typeof (entry as any)?.sortOrder === "number" && Number.isFinite((entry as any).sortOrder)
              ? (entry as any).sortOrder
              : catalogIndex
        }))
      : []
  }));
}

function validateFieldKeys(fields: Array<{ key: string }>) {
  const seen = new Set<string>();
  for (const field of fields) {
    const key = String(field.key || "").trim();
    if (!key) return "Technisches Feld braucht einen stabilen Key";
    if (seen.has(key)) return `Doppelter technischer Feld-Key: ${key}`;
    seen.add(key);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  return NextResponse.json(await buildPresetResponse());
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, technicalFieldPresetCreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof technicalFieldPresetCreateSchema.parse>;

  const fieldKeyError = validateFieldKeys(body.fields);
  if (fieldKeyError) {
    return NextResponse.json({ error: fieldKeyError }, { status: 400 });
  }

  const normalizedFields = normalizePresetFields(body.fields as Array<Record<string, unknown>>);

  await ensureTechnicalFieldPresets(prisma as any);
  const existing = await prisma.technicalFieldPreset.findUnique({
    where: { key: body.key }
  });
  if (existing) {
    return NextResponse.json({ error: "Technischer Feldsatz mit diesem Key existiert bereits." }, { status: 409 });
  }

  const created = await prisma.technicalFieldPreset.create({
    data: {
      key: body.key,
      name: body.name,
      description: body.description || "",
      fieldsJson: serializeTechnicalFieldPresetFields(normalizedFields)
    }
  });

  return NextResponse.json(
    {
      id: created.id,
      key: created.key,
      name: created.name,
      description: created.description,
      fields: normalizedFields,
      assignmentCount: 0,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    },
    { status: 201 }
  );
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, technicalFieldPresetUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof technicalFieldPresetUpdateSchema.parse>;

  const fieldKeyError = validateFieldKeys(body.fields);
  if (fieldKeyError) {
    return NextResponse.json({ error: fieldKeyError }, { status: 400 });
  }

  const normalizedFields = normalizePresetFields(body.fields as Array<Record<string, unknown>>);

  const existing = await prisma.technicalFieldPreset.findUnique({
    where: { id: body.id }
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.technicalFieldPreset.update({
    where: { id: body.id },
    data: {
      name: body.name,
      description: body.description || "",
      fieldsJson: serializeTechnicalFieldPresetFields(normalizedFields)
    }
  });

  const assignmentCount = await prisma.technicalFieldScopeAssignment.count({
    where: { presetKey: updated.key }
  });

  return NextResponse.json({
    id: updated.id,
    key: updated.key,
    name: updated.name,
    description: updated.description,
    fields: normalizedFields,
    assignmentCount,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, technicalFieldPresetDeleteSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof technicalFieldPresetDeleteSchema.parse>;

  const existing = await prisma.technicalFieldPreset.findUnique({
    where: { id: body.id }
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assignmentCount = await prisma.technicalFieldScopeAssignment.count({
    where: { presetKey: existing.key }
  });
  if (assignmentCount > 0) {
    return NextResponse.json({ error: "Technischer Feldsatz ist noch zugewiesen und kann nicht geloescht werden." }, { status: 409 });
  }

  await prisma.technicalFieldPreset.delete({
    where: { id: body.id }
  });

  return NextResponse.json({ ok: true, id: existing.id });
}
