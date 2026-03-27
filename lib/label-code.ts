import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveCategoryCode } from "@/lib/label-catalog";

type LabelCodeDb = Pick<Prisma.TransactionClient, "category" | "labelType" | "labelConfig" | "categoryTypeCounter">;

function buildLabelCode(opts: {
  categoryCode: string;
  typeCode: string;
  number: number;
  separator: string;
  digits: number;
  prefix?: string | null;
  suffix?: string | null;
}) {
  const n = String(opts.number).padStart(opts.digits, "0");
  const core = [opts.categoryCode, opts.typeCode, n].join(opts.separator);
  return `${opts.prefix || ""}${core}${opts.suffix || ""}`;
}

async function assignNextLabelCodeInDb(db: LabelCodeDb, categoryId: string, typeId: string) {
  const [category, type, config] = await Promise.all([
    db.category.findUniqueOrThrow({ where: { id: categoryId } }),
    db.labelType.findUniqueOrThrow({ where: { id: typeId } }),
    db.labelConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } })
  ]);

  const counter = await db.categoryTypeCounter.upsert({
    where: { categoryId_typeId: { categoryId: category.id, typeId: type.id } },
    create: { categoryId: category.id, typeId: type.id, nextNumber: 1 },
    update: {}
  });

  const labelCode = buildLabelCode({
    categoryCode: resolveCategoryCode(category),
    typeCode: type.code,
    number: counter.nextNumber,
    separator: config.separator,
    digits: config.digits,
    prefix: config.prefix,
    suffix: config.suffix
  });

  await db.categoryTypeCounter.update({
    where: { id: counter.id },
    data: { nextNumber: { increment: 1 } }
  });

  return labelCode;
}

export async function assignNextLabelCode(categoryId: string, typeId: string, db?: LabelCodeDb) {
  if (db) return assignNextLabelCodeInDb(db, categoryId, typeId);
  return prisma.$transaction((tx) => assignNextLabelCodeInDb(tx, categoryId, typeId));
}

export async function previewLabelCode(categoryId: string, typeId: string) {
  const [category, type, config, counter] = await Promise.all([
    prisma.category.findUniqueOrThrow({ where: { id: categoryId } }),
    prisma.labelType.findUniqueOrThrow({ where: { id: typeId } }),
    prisma.labelConfig.findUnique({ where: { id: "default" } }),
    prisma.categoryTypeCounter.findUnique({ where: { categoryId_typeId: { categoryId, typeId } } })
  ]);

  const cfg = config || {
    separator: "-",
    digits: 3,
    prefix: null,
    suffix: null
  };

  return buildLabelCode({
    categoryCode: resolveCategoryCode(category),
    typeCode: type.code,
    number: counter?.nextNumber || 1,
    separator: cfg.separator,
    digits: cfg.digits,
    prefix: cfg.prefix,
    suffix: cfg.suffix
  });
}

export async function previewBulkLabelCodes(categoryId: string, typeId: string, count: number) {
  const [category, type, config, counter] = await Promise.all([
    prisma.category.findUniqueOrThrow({ where: { id: categoryId } }),
    prisma.labelType.findUniqueOrThrow({ where: { id: typeId } }),
    prisma.labelConfig.findUnique({ where: { id: "default" } }),
    prisma.categoryTypeCounter.findUnique({ where: { categoryId_typeId: { categoryId, typeId } } })
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
      categoryCode: resolveCategoryCode(category),
      typeCode: type.code,
      number: start + idx,
      separator: cfg.separator,
      digits: cfg.digits,
      prefix: cfg.prefix,
      suffix: cfg.suffix
    })
  );
}
