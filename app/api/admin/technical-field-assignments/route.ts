import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/http";
import {
  technicalFieldScopeAssignmentCreateSchema,
  technicalFieldScopeAssignmentDeleteSchema,
  technicalFieldScopeAssignmentUpdateSchema
} from "@/lib/validation";
import {
  listTechnicalFieldScopeAssignments,
  removeTechnicalFieldScopeAssignment,
  syncTechnicalFieldScopeAssignment,
  TechnicalFieldAssignmentError
} from "@/lib/technical-field-assignments";

async function buildAssignmentResponse() {
  const [assignments, managedFields] = await Promise.all([
    listTechnicalFieldScopeAssignments(prisma),
    prisma.customField.findMany({
      where: {
        managedPresetFieldKey: { not: null }
      },
      select: {
        technicalFieldScopeAssignmentId: true,
        isActive: true
      }
    })
  ]);

  const counts = new Map<string, { total: number; active: number }>();
  for (const field of managedFields) {
    const assignmentId = field.technicalFieldScopeAssignmentId;
    if (!assignmentId) continue;
    const current = counts.get(assignmentId) || { total: 0, active: 0 };
    current.total += 1;
    if (field.isActive) current.active += 1;
    counts.set(assignmentId, current);
  }

  return assignments.map((assignment) => ({
    ...assignment,
    managedFieldCount: counts.get(assignment.id)?.total || 0,
    activeManagedFieldCount: counts.get(assignment.id)?.active || 0
  }));
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  return NextResponse.json(await buildAssignmentResponse());
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, technicalFieldScopeAssignmentCreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof technicalFieldScopeAssignmentCreateSchema.parse>;

  try {
    const result = await prisma.$transaction((tx) =>
      syncTechnicalFieldScopeAssignment(tx, {
        categoryId: body.categoryId,
        typeId: body.typeId,
        presetKey: body.presetKey
      })
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof TechnicalFieldAssignmentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, technicalFieldScopeAssignmentUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof technicalFieldScopeAssignmentUpdateSchema.parse>;

  const existing = await prisma.technicalFieldScopeAssignment.findUnique({
    where: { id: body.id }
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.categoryId !== body.categoryId || existing.typeId !== body.typeId) {
    return NextResponse.json({ error: "Scope change not supported" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction((tx) =>
      syncTechnicalFieldScopeAssignment(tx, {
        categoryId: body.categoryId,
        typeId: body.typeId,
        presetKey: body.presetKey
      })
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TechnicalFieldAssignmentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, technicalFieldScopeAssignmentDeleteSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof technicalFieldScopeAssignmentDeleteSchema.parse>;

  const removed = await prisma.$transaction((tx) =>
    removeTechnicalFieldScopeAssignment(tx, { id: body.id })
  );
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: removed.id });
}
