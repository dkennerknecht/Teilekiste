import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { idPayloadSchema, storageShelfCreateSchema, storageShelfUpdateSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  return NextResponse.json(
    await prisma.storageShelf.findMany({
      include: {
        storageLocation: {
          select: { id: true, name: true, code: true }
        },
        _count: {
          select: {
            items: {
              where: {
                deletedAt: null,
                isArchived: false,
                mergedIntoItemId: null
              }
            },
            bins: {
              where: {
                isActive: true
              }
            }
          }
        }
      },
      orderBy: [{ storageLocation: { name: "asc" } }, { code: "asc" }, { name: "asc" }]
    })
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, storageShelfCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { name, code, description, mode, storageLocationId } = parsed.data as ReturnType<typeof storageShelfCreateSchema.parse>;

  const shelf = await prisma.storageShelf.create({
    data: { name, code: code?.trim().toUpperCase() || null, description: description?.trim() || null, mode, storageLocationId },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      }
    }
  });
  return NextResponse.json(shelf, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, storageShelfUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const { id, name, code, description, mode, storageLocationId } = parsed.data as ReturnType<typeof storageShelfUpdateSchema.parse>;

  const updated = await prisma.storageShelf.update({
    where: { id },
    data: {
      name,
      code: code?.trim().toUpperCase() || null,
      description: description?.trim() || null,
      mode,
      storageLocationId
    },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      }
    }
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, idPayloadSchema);
  if ("error" in parsed) return parsed.error;
  const { id } = parsed.data as ReturnType<typeof idPayloadSchema.parse>;

  await prisma.storageShelf.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
