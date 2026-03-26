import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditDb = Pick<Prisma.TransactionClient, "auditLog">;

export async function auditLog(input: {
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}, db: AuditDb = prisma) {
  await db.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? null : JSON.stringify(input.before),
      after: input.after === undefined ? null : JSON.stringify(input.after)
    }
  });
}
