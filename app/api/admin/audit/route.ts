import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parsePagination } from "@/lib/http";
import { summarizeAuditEntry } from "@/lib/audit-view";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const entity = req.nextUrl.searchParams.get("entity")?.trim() || "";
  const action = req.nextUrl.searchParams.get("action")?.trim() || "";
  const itemId = req.nextUrl.searchParams.get("itemId")?.trim() || "";
  const { limit, offset } = parsePagination(req.nextUrl.searchParams, 200);

  const matchedItems =
    q.length > 0
      ? await prisma.item.findMany({
          where: {
            OR: [{ labelCode: { contains: q } }, { name: { contains: q } }]
          },
          select: { id: true },
          take: 25
        })
      : [];

  const itemIdsFromQuery = matchedItems.map((item) => item.id);
  const where = {
    entity: entity || undefined,
    entityId: itemId || undefined,
    action: action ? { contains: action } : undefined,
    OR: q
      ? [
          { action: { contains: q } },
          { entity: { contains: q } },
          { entityId: { contains: q } },
          { user: { is: { name: { contains: q } } } },
          { user: { is: { email: { contains: q } } } },
          ...(itemIdsFromQuery.length ? [{ entityId: { in: itemIdsFromQuery } }] : [])
        ]
      : undefined
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset
    }),
    prisma.auditLog.count({ where })
  ]);

  const relatedItemIds = Array.from(
    new Set(rows.filter((row) => row.entity === "Item").map((row) => row.entityId))
  );
  const relatedItems = relatedItemIds.length
    ? await prisma.item.findMany({
        where: { id: { in: relatedItemIds } },
        select: { id: true, labelCode: true, name: true }
      })
    : [];
  const itemMap = new Map(relatedItems.map((item) => [item.id, item]));

  return NextResponse.json({
    total,
    limit,
    offset,
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      createdAt: row.createdAt,
      user: row.user,
      item: row.entity === "Item" ? itemMap.get(row.entityId) || null : null,
      summary: summarizeAuditEntry(row)
    }))
  });
}
