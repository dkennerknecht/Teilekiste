import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/http";
import { idPayloadSchema, importProfileCreateSchema, importProfileUpdateSchema } from "@/lib/validation";
import { hydrateImportProfile, serializeImportProfileMappingConfig } from "@/lib/import-profiles";

const importProfileTable = (prisma as any).importProfile as {
  findMany: (args?: unknown) => Promise<any[]>;
  findFirst: (args?: unknown) => Promise<any>;
  findUnique: (args?: unknown) => Promise<any>;
  create: (args: unknown) => Promise<any>;
  update: (args: unknown) => Promise<any>;
  delete: (args: unknown) => Promise<any>;
};

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const profiles = await importProfileTable.findMany({
    orderBy: [{ name: "asc" }]
  });

  return NextResponse.json(profiles.map((profile: any) => hydrateImportProfile(profile)));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, importProfileCreateSchema);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as ReturnType<typeof importProfileCreateSchema.parse>;
  const existing = await importProfileTable.findFirst({
    where: { name: body.name }
  });
  if (existing) {
    return NextResponse.json({ error: "Import-Profil mit diesem Namen existiert bereits." }, { status: 409 });
  }

  const created = await importProfileTable.create({
    data: {
      name: body.name,
      description: body.description || null,
      headerFingerprint: body.headerFingerprint || null,
      delimiterMode: body.delimiterMode,
      mappingConfig: serializeImportProfileMappingConfig(body.mappingConfig)
    }
  });

  return NextResponse.json(hydrateImportProfile(created), { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, importProfileUpdateSchema);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as ReturnType<typeof importProfileUpdateSchema.parse>;
  const existing = await importProfileTable.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.name) {
    const conflicting = await importProfileTable.findFirst({
      where: {
        name: body.name,
        id: { not: body.id }
      }
    });
    if (conflicting) {
      return NextResponse.json({ error: "Import-Profil mit diesem Namen existiert bereits." }, { status: 409 });
    }
  }

  const updated = await importProfileTable.update({
    where: { id: body.id },
    data: {
      name: body.name,
      description: body.description === undefined ? undefined : body.description || null,
      headerFingerprint: body.headerFingerprint === undefined ? undefined : body.headerFingerprint || null,
      delimiterMode: body.delimiterMode,
      mappingConfig: body.mappingConfig === undefined ? undefined : serializeImportProfileMappingConfig(body.mappingConfig)
    }
  });

  return NextResponse.json(hydrateImportProfile(updated));
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, idPayloadSchema);
  if ("error" in parsed) return parsed.error;

  const { id } = parsed.data as ReturnType<typeof idPayloadSchema.parse>;
  const existing = await importProfileTable.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await importProfileTable.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
