import type { Prisma, PrismaClient } from "@prisma/client";

type CatalogDb = Pick<PrismaClient, "area" | "category" | "labelType"> | Pick<Prisma.TransactionClient, "area" | "category" | "labelType">;

type CategoryLike = {
  name: string;
  code?: string | null;
};

export const SYSTEM_LABEL_AREA = {
  code: "LB",
  name: "Label-System"
} as const;

export const LABEL_CATEGORIES = [
  { name: "Elektronik", code: "EL" },
  { name: "Elektro-Installation", code: "EI" },
  { name: "Befestigung", code: "BE" },
  { name: "Kabel", code: "KA" }
] as const;

export const LABEL_TYPES = [
  { name: "Widerstand", code: "WI" },
  { name: "Kondensator", code: "KO" },
  { name: "Mikrocontroller", code: "MC" },
  { name: "Temperatursensor", code: "TS" },
  { name: "Relais", code: "RE" },
  { name: "Installationsschuetz", code: "IS" },
  { name: "NYM-J", code: "NY" },
  { name: "Litze", code: "LI" },
  { name: "Adernendhuelse", code: "AH" }
] as const;

const CATEGORY_CODE_BY_NAME = new Map<string, string>(LABEL_CATEGORIES.map((entry) => [entry.name, entry.code]));

function normalizeAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");
}

function sanitizeCode(value: string) {
  return normalizeAscii(value).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 2);
}

function buildCodeCandidates(name: string) {
  const normalized = normalizeAscii(name).toUpperCase();
  const words = normalized.split(/[^A-Z0-9]+/).filter(Boolean);
  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  const candidates: string[] = [];

  if (words.length >= 2) {
    candidates.push(`${words[0][0]}${words[1][0]}`);
    candidates.push(`${words[0][0]}${words[1].slice(0, 1)}`);
  }

  if (compact.length >= 2) {
    candidates.push(compact.slice(0, 2));
    candidates.push(`${compact[0]}${compact.at(-1)}`);
  }

  for (let index = 1; index < compact.length; index += 1) {
    candidates.push(`${compact[0]}${compact[index]}`);
  }

  return Array.from(new Set(candidates.map(sanitizeCode).filter((candidate) => candidate.length === 2)));
}

function pickAvailableCode(name: string, takenCodes: Set<string>) {
  for (const candidate of buildCodeCandidates(name)) {
    if (!takenCodes.has(candidate)) return candidate;
  }

  const normalized = normalizeAscii(name).replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "XX";
  for (let charCode = 65; charCode <= 90; charCode += 1) {
    const candidate = `${normalized[0] || "X"}${String.fromCharCode(charCode)}`;
    if (!takenCodes.has(candidate)) return candidate;
  }

  return "XX";
}

export function resolveCategoryCode(category: CategoryLike) {
  const explicitCode = sanitizeCode(category.code || "");
  if (explicitCode.length === 2) return explicitCode;

  const mappedCode = CATEGORY_CODE_BY_NAME.get(category.name);
  if (mappedCode) return mappedCode;

  return buildCodeCandidates(category.name)[0] || "XX";
}

export async function syncLabelCatalog(db: CatalogDb) {
  const categoriesWithCodes = await db.category.count({
    where: {
      code: {
        not: null
      }
    }
  });

  if (categoriesWithCodes === 0) {
    for (const entry of LABEL_CATEGORIES) {
      await db.category.upsert({
        where: { name: entry.name },
        update: {},
        create: { name: entry.name, code: entry.code }
      });
    }
  }

  const categories = await db.category.findMany({
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" }
  });
  const takenCodes = new Set(
    categories
      .map((category) => sanitizeCode(category.code || ""))
      .filter((code) => code.length === 2)
  );

  for (const category of categories) {
    if (sanitizeCode(category.code || "").length === 2) continue;
    const nextCode = pickAvailableCode(category.name, takenCodes);
    takenCodes.add(nextCode);
    await db.category.update({
      where: { id: category.id },
      data: { code: nextCode }
    });
  }

  const area = await db.area.upsert({
    where: { code: SYSTEM_LABEL_AREA.code },
    update: { name: SYSTEM_LABEL_AREA.name, active: false },
    create: { code: SYSTEM_LABEL_AREA.code, name: SYSTEM_LABEL_AREA.name, active: false }
  });

  const systemTypesCount = await db.labelType.count({
    where: { areaId: area.id }
  });

  if (systemTypesCount === 0) {
    for (const entry of LABEL_TYPES) {
      await db.labelType.create({
        data: { areaId: area.id, code: entry.code, name: entry.name, active: true }
      });
    }
  }

  return { areaId: area.id };
}
