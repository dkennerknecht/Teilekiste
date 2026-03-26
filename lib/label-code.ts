import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type LabelCodeDb = Pick<Prisma.TransactionClient, "area" | "labelType" | "labelConfig" | "sequenceCounter">;

function buildLabelCode(opts: {
  areaCode: string;
  typeCode: string;
  number: number;
  separator: string;
  digits: number;
  prefix?: string | null;
  suffix?: string | null;
}) {
  const n = String(opts.number).padStart(opts.digits, "0");
  const core = [opts.areaCode, opts.typeCode, n].join(opts.separator);
  return `${opts.prefix || ""}${core}${opts.suffix || ""}`;
}

async function assignNextLabelCodeInDb(db: LabelCodeDb, areaId: string, typeId: string) {
  const [area, type, config] = await Promise.all([
    db.area.findUniqueOrThrow({ where: { id: areaId } }),
    db.labelType.findUniqueOrThrow({ where: { id: typeId } }),
    db.labelConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } })
  ]);

  if (type.areaId !== area.id) {
    throw new Error("TYPE_AREA_MISMATCH");
  }

  const counter = await db.sequenceCounter.upsert({
    where: { areaId_typeId: { areaId: area.id, typeId: type.id } },
    create: { areaId: area.id, typeId: type.id, nextNumber: 1 },
    update: {}
  });

  const labelCode = buildLabelCode({
    areaCode: area.code,
    typeCode: type.code,
    number: counter.nextNumber,
    separator: config.separator,
    digits: config.digits,
    prefix: config.prefix,
    suffix: config.suffix
  });

  await db.sequenceCounter.update({
    where: { id: counter.id },
    data: { nextNumber: { increment: 1 } }
  });

  return labelCode;
}

export async function assignNextLabelCode(areaId: string, typeId: string, db?: LabelCodeDb) {
  if (db) return assignNextLabelCodeInDb(db, areaId, typeId);
  return prisma.$transaction((tx) => assignNextLabelCodeInDb(tx, areaId, typeId));
}

export async function previewLabelCode(areaId: string, typeId: string) {
  const [area, type, config, counter] = await Promise.all([
    prisma.area.findUniqueOrThrow({ where: { id: areaId } }),
    prisma.labelType.findUniqueOrThrow({ where: { id: typeId } }),
    prisma.labelConfig.findUnique({ where: { id: "default" } }),
    prisma.sequenceCounter.findUnique({ where: { areaId_typeId: { areaId, typeId } } })
  ]);

  const cfg = config || {
    separator: "-",
    digits: 3,
    prefix: null,
    suffix: null
  };

  return buildLabelCode({
    areaCode: area.code,
    typeCode: type.code,
    number: counter?.nextNumber || 1,
    separator: cfg.separator,
    digits: cfg.digits,
    prefix: cfg.prefix,
    suffix: cfg.suffix
  });
}

export async function previewBulkLabelCodes(areaId: string, typeId: string, count: number) {
  const [area, type, config, counter] = await Promise.all([
    prisma.area.findUniqueOrThrow({ where: { id: areaId } }),
    prisma.labelType.findUniqueOrThrow({ where: { id: typeId } }),
    prisma.labelConfig.findUnique({ where: { id: "default" } }),
    prisma.sequenceCounter.findUnique({ where: { areaId_typeId: { areaId, typeId } } })
  ]);

  const cfg = config || {
    separator: "-",
    digits: 3,
    prefix: null,
    suffix: null
  };
  const start = counter?.nextNumber || 1;

  return Array.from({ length: count }).map((_, idx) =>
    buildLabelCode({
      areaCode: area.code,
      typeCode: type.code,
      number: start + idx,
      separator: cfg.separator,
      digits: cfg.digits,
      prefix: cfg.prefix,
      suffix: cfg.suffix
    })
  );
}
