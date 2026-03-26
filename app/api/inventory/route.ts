import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/api";
import { resolveAllowedLocationIds } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const auth = await requireWriteAccess();
  if (auth.error) return auth.error;

  const locationId = req.nextUrl.searchParams.get("storageLocationId") || undefined;
  const storageArea = req.nextUrl.searchParams.get("storageArea") || undefined;
  const bin = req.nextUrl.searchParams.get("bin") || undefined;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const where = {
    deletedAt: null,
    storageLocationId: allowedLocationIds
      ? { in: locationId ? [locationId].filter((id) => allowedLocationIds.includes(id)) : allowedLocationIds.length ? allowedLocationIds : ["__none__"] }
      : locationId,
    storageArea: storageArea ? { contains: storageArea } : undefined,
    bin: bin ? { contains: bin } : undefined
  };

  const items = await prisma.item.findMany({ where, orderBy: [{ storageArea: "asc" }, { bin: "asc" }, { labelCode: "asc" }] });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess();
  if (auth.error) return auth.error;

  const body = (await req.json()) as { updates: Array<{ itemId: string; countedStock: number; note?: string }> };
  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const applied = [] as Array<{ itemId: string; before: number; after: number; delta: number }>;

      for (const update of body.updates || []) {
        const item = await tx.item.findUnique({ where: { id: update.itemId } });
        if (!item) continue;
        if (allowedLocationIds && !allowedLocationIds.includes(item.storageLocationId)) {
          throw new Error("FORBIDDEN");
        }
        const delta = update.countedStock - item.stock;
        if (delta === 0) continue;

        const newItem = await tx.item.update({
          where: { id: item.id },
          data: { stock: update.countedStock }
        });

        await tx.stockMovement.create({
          data: {
            itemId: item.id,
            delta,
            reason: "INVENTORY",
            note: update.note || "Inventurabgleich",
            userId: auth.user!.id
          }
        });

        applied.push({ itemId: item.id, before: item.stock, after: newItem.stock, delta });
      }

      return applied;
    });

    return NextResponse.json({ applied: result });
  } catch (error) {
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
}
