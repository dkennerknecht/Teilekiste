type DuplicateReason =
  | "gleiche-mpn"
  | "gleicher-hersteller-und-mpn"
  | "gleicher-name"
  | "aehnlicher-name"
  | "gleicher-type"
  | "gleicher-hersteller";

export type DuplicateItemRecord = {
  id: string;
  labelCode: string;
  name: string;
  categoryId: string;
  typeId?: string | null;
  storageLocationId?: string | null;
  unit: string;
  manufacturer?: string | null;
  mpn?: string | null;
  isArchived?: boolean;
  deletedAt?: Date | string | null;
  mergedIntoItemId?: string | null;
  mergedAt?: Date | string | null;
  category?: { id: string; name: string; code?: string | null } | null;
  labelType?: { id: string; code: string; name: string } | null;
};

export type DuplicateProbe = {
  itemId?: string | null;
  name?: string | null;
  manufacturer?: string | null;
  mpn?: string | null;
  categoryId?: string | null;
  typeId?: string | null;
  storageLocationId?: string | null;
  unit?: string | null;
};

export type DuplicateCandidateMatch<TItem extends DuplicateItemRecord = DuplicateItemRecord> = {
  item: TItem;
  score: number;
  reasons: string[];
  mergeEligible: boolean;
  mergeBlockedReasons: string[];
};

export type DuplicatePairMatch<TItem extends DuplicateItemRecord = DuplicateItemRecord> = {
  leftItem: TItem;
  rightItem: TItem;
  score: number;
  reasons: string[];
  mergeEligible: boolean;
  mergeBlockedReasons: string[];
};

type NormalizedDuplicateRecord<TItem extends DuplicateItemRecord = DuplicateItemRecord> = {
  item: TItem;
  name: string;
  manufacturer: string;
  mpn: string;
  compactName: string;
  nameTokens: string[];
};

function normalizeAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");
}

export function normalizeDuplicateText(value: string | null | undefined) {
  return normalizeAscii(String(value || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompactText(value: string | null | undefined) {
  return normalizeDuplicateText(value).replace(/\s+/g, "");
}

function buildNameTokens(value: string | null | undefined) {
  return normalizeDuplicateText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function normalizeDuplicateItem<TItem extends DuplicateItemRecord>(item: TItem): NormalizedDuplicateRecord<TItem> {
  return {
    item,
    name: normalizeDuplicateText(item.name),
    manufacturer: normalizeDuplicateText(item.manufacturer),
    mpn: normalizeDuplicateText(item.mpn),
    compactName: normalizeCompactText(item.name),
    nameTokens: buildNameTokens(item.name)
  };
}

function normalizeDuplicateProbe(probe: DuplicateProbe): NormalizedDuplicateRecord<DuplicateItemRecord> {
  const item: DuplicateItemRecord = {
    id: String(probe.itemId || "__probe__"),
    labelCode: "",
    name: String(probe.name || ""),
    categoryId: String(probe.categoryId || ""),
    typeId: probe.typeId || null,
    storageLocationId: probe.storageLocationId || null,
    unit: String(probe.unit || ""),
    manufacturer: probe.manufacturer || null,
    mpn: probe.mpn || null
  };

  return normalizeDuplicateItem(item);
}

function buildNameBlockingKeys(nameTokens: string[], compactName: string, typeId?: string | null) {
  const keys: string[] = [];
  if (compactName) {
    keys.push(`name:${compactName}`);
    keys.push(`name-prefix:${compactName.slice(0, 10)}`);
  }
  if (nameTokens.length) {
    for (const token of nameTokens.slice(0, 3)) {
      keys.push(`name-token:${token}`);
      if (typeId) {
        keys.push(`type-name-token:${typeId}:${token}`);
      }
    }
    keys.push(`name-tokens:${nameTokens.slice(0, 2).join(" ")}`);
    const sortedTokens = [...new Set(nameTokens)].sort().slice(0, 3);
    if (sortedTokens.length >= 2) {
      keys.push(`name-sorted:${sortedTokens.join(" ")}`);
      if (typeId) {
        keys.push(`type-name-sorted:${typeId}:${sortedTokens.join(" ")}`);
      }
    }
  }
  return keys;
}

export function buildDuplicateBlockingKeys(record: Pick<DuplicateItemRecord, "typeId"> & { name?: string | null; manufacturer?: string | null; mpn?: string | null }) {
  const normalizedName = normalizeDuplicateText(record.name);
  const compactName = normalizedName.replace(/\s+/g, "");
  const normalizedManufacturer = normalizeDuplicateText(record.manufacturer);
  const normalizedMpn = normalizeDuplicateText(record.mpn);
  const nameTokens = buildNameTokens(record.name);

  const keys = new Set<string>();
  if (normalizedMpn) {
    keys.add(`mpn:${normalizedMpn}`);
    if (normalizedManufacturer) {
      keys.add(`manufacturer-mpn:${normalizedManufacturer}:${normalizedMpn}`);
    }
  }

  for (const key of buildNameBlockingKeys(nameTokens, compactName, record.typeId || null)) {
    keys.add(key);
  }

  return Array.from(keys);
}

function buildBigrams(value: string) {
  if (value.length < 2) return value ? [value] : [];
  const grams: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    grams.push(value.slice(index, index + 2));
  }
  return grams;
}

function diceCoefficient(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftBigrams = buildBigrams(left);
  const rightBigrams = buildBigrams(right);
  if (!leftBigrams.length || !rightBigrams.length) return 0;

  const rightCounts = new Map<string, number>();
  for (const gram of rightBigrams) {
    rightCounts.set(gram, (rightCounts.get(gram) || 0) + 1);
  }

  let overlap = 0;
  for (const gram of leftBigrams) {
    const current = rightCounts.get(gram) || 0;
    if (current <= 0) continue;
    overlap += 1;
    rightCounts.set(gram, current - 1);
  }

  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
}

function overlapRatio(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let overlap = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) overlap += 1;
  }
  return overlap / Math.max(leftSet.size, rightSet.size);
}

function dedupeReasons(reasons: DuplicateReason[]) {
  const labels: Record<DuplicateReason, string> = {
    "gleiche-mpn": "Gleiche MPN",
    "gleicher-hersteller-und-mpn": "Gleicher Hersteller + gleiche MPN",
    "gleicher-name": "Gleicher Name",
    "aehnlicher-name": "Aehnlicher Name",
    "gleicher-type": "Gleicher Type",
    "gleicher-hersteller": "Gleicher Hersteller"
  };

  return Array.from(new Set(reasons)).map((reason) => labels[reason]);
}

function scoreDuplicateRecords(left: NormalizedDuplicateRecord, right: NormalizedDuplicateRecord) {
  const differentStorageLocation =
    !!left.item.storageLocationId &&
    !!right.item.storageLocationId &&
    left.item.storageLocationId !== right.item.storageLocationId;

  if (differentStorageLocation) {
    return {
      score: 0,
      reasons: [] as string[]
    };
  }

  let score = 0;
  const reasons: DuplicateReason[] = [];

  const hasSameMpn = !!left.mpn && left.mpn === right.mpn;
  const hasSameManufacturer = !!left.manufacturer && left.manufacturer === right.manufacturer;
  const hasSameName = !!left.compactName && left.compactName === right.compactName;
  const hasContainedName =
    !!left.compactName &&
    !!right.compactName &&
    left.compactName !== right.compactName &&
    Math.min(left.compactName.length, right.compactName.length) >= 4 &&
    (left.compactName.includes(right.compactName) || right.compactName.includes(left.compactName));
  const nameSimilarity = diceCoefficient(left.compactName, right.compactName);
  const tokenOverlap = overlapRatio(left.nameTokens, right.nameTokens);
  const sameType = !!left.item.typeId && left.item.typeId === right.item.typeId;

  if (hasSameMpn) {
    score += hasSameManufacturer ? 95 : 85;
    reasons.push(hasSameManufacturer ? "gleicher-hersteller-und-mpn" : "gleiche-mpn");
  }

  if (hasSameName) {
    score += 55;
    reasons.push("gleicher-name");
  } else if (hasContainedName || nameSimilarity >= 0.84 || tokenOverlap >= 0.8) {
    score += 35;
    reasons.push("aehnlicher-name");
  }

  if (sameType) {
    score += 12;
    reasons.push("gleicher-type");
  }

  if (hasSameManufacturer && !hasSameMpn) {
    score += 10;
    reasons.push("gleicher-hersteller");
  }

  return {
    score,
    reasons: dedupeReasons(reasons)
  };
}

function isActiveDuplicateItem(item: DuplicateItemRecord) {
  return !item.deletedAt && !item.mergedIntoItemId && !item.isArchived;
}

export function getMergeEligibility(source: DuplicateItemRecord, target: DuplicateItemRecord) {
  const blockedReasons: string[] = [];

  if (source.id === target.id) blockedReasons.push("Quelle und Ziel duerfen nicht identisch sein");
  if (source.deletedAt || target.deletedAt) blockedReasons.push("Geloeschte Items koennen nicht zusammengefuehrt werden");
  if (source.mergedIntoItemId || target.mergedIntoItemId) blockedReasons.push("Bereits zusammengefuehrte Items koennen nicht erneut gemerged werden");
  if (source.isArchived || target.isArchived) blockedReasons.push("Archivierte Items koennen in V1 nicht gemerged werden");
  if (!source.typeId || !target.typeId || source.typeId !== target.typeId) blockedReasons.push("Merge nur bei gleichem Type moeglich");
  if (source.categoryId !== target.categoryId) blockedReasons.push("Merge nur bei gleicher Kategorie moeglich");
  if (!!source.storageLocationId && !!target.storageLocationId && source.storageLocationId !== target.storageLocationId) {
    blockedReasons.push("Merge nur bei gleichem Lagerort moeglich");
  }
  if (source.unit !== target.unit) blockedReasons.push("Merge nur bei gleicher Einheit moeglich");

  return {
    mergeEligible: blockedReasons.length === 0,
    mergeBlockedReasons: blockedReasons
  };
}

function compareMatchOrder(left: { score: number; reasons: string[] }, right: { score: number; reasons: string[] }) {
  return right.score - left.score || right.reasons.length - left.reasons.length;
}

export function findDuplicateCandidates<TItem extends DuplicateItemRecord>(items: TItem[], probe: DuplicateProbe, input?: { limit?: number }) {
  const normalizedProbe = normalizeDuplicateProbe(probe);
  const candidateIds = new Set<string>();
  const blockingKeys = buildDuplicateBlockingKeys({
    name: probe.name,
    manufacturer: probe.manufacturer,
    mpn: probe.mpn,
    typeId: probe.typeId || null
  });

  if (!blockingKeys.length) return [] as DuplicateCandidateMatch<TItem>[];

  const normalizedItems = items
    .filter((item) => isActiveDuplicateItem(item) && item.id !== probe.itemId)
    .map((item) => normalizeDuplicateItem(item));

  const buckets = new Map<string, NormalizedDuplicateRecord<TItem>[]>();
  for (const item of normalizedItems) {
    for (const key of buildDuplicateBlockingKeys(item.item)) {
      const current = buckets.get(key) || [];
      current.push(item);
      buckets.set(key, current);
    }
  }

  const matches: Array<DuplicateCandidateMatch<TItem>> = [];
  for (const key of blockingKeys) {
    for (const candidate of buckets.get(key) || []) {
      if (candidateIds.has(candidate.item.id)) continue;
      candidateIds.add(candidate.item.id);
      const scored = scoreDuplicateRecords(normalizedProbe, candidate);
      if (scored.score < 35) continue;
      const eligibility = getMergeEligibility(candidate.item, {
        id: String(probe.itemId || "__probe__"),
        labelCode: "",
        name: String(probe.name || ""),
        categoryId: String(probe.categoryId || ""),
        typeId: probe.typeId || null,
        storageLocationId: probe.storageLocationId || null,
        unit: String(probe.unit || candidate.item.unit),
        manufacturer: probe.manufacturer || null,
        mpn: probe.mpn || null,
        isArchived: false,
        deletedAt: null,
        mergedIntoItemId: null
      });
      matches.push({
        item: candidate.item,
        score: scored.score,
        reasons: scored.reasons,
        mergeEligible: eligibility.mergeEligible,
        mergeBlockedReasons: eligibility.mergeBlockedReasons
      });
    }
  }

  return matches
    .sort((left, right) => compareMatchOrder(left, right) || left.item.labelCode.localeCompare(right.item.labelCode))
    .slice(0, input?.limit || 10);
}

export function buildDuplicatePairs<TItem extends DuplicateItemRecord>(items: TItem[], input?: { minScore?: number; onlyMergeEligible?: boolean }) {
  const normalizedItems = items.filter((item) => isActiveDuplicateItem(item)).map((item) => normalizeDuplicateItem(item));
  const pairKeys = new Set<string>();
  const pairs: Array<DuplicatePairMatch<TItem>> = [];
  const buckets = new Map<string, NormalizedDuplicateRecord<TItem>[]>();

  for (const item of normalizedItems) {
    for (const key of buildDuplicateBlockingKeys(item.item)) {
      const current = buckets.get(key) || [];
      current.push(item);
      buckets.set(key, current);
    }
  }

  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    for (let leftIndex = 0; leftIndex < bucket.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < bucket.length; rightIndex += 1) {
        const left = bucket[leftIndex];
        const right = bucket[rightIndex];
        const pairKey = [left.item.id, right.item.id].sort().join(":");
        if (pairKeys.has(pairKey)) continue;
        pairKeys.add(pairKey);

        const scored = scoreDuplicateRecords(left, right);
        if (scored.score < (input?.minScore || 45)) continue;

        const ordered = [left.item, right.item].sort((a, b) => a.labelCode.localeCompare(b.labelCode));
        const eligibility = getMergeEligibility(ordered[0], ordered[1]);
        if (input?.onlyMergeEligible && !eligibility.mergeEligible) continue;

        pairs.push({
          leftItem: ordered[0],
          rightItem: ordered[1],
          score: scored.score,
          reasons: scored.reasons,
          mergeEligible: eligibility.mergeEligible,
          mergeBlockedReasons: eligibility.mergeBlockedReasons
        });
      }
    }
  }

  return pairs.sort(
    (left, right) =>
      compareMatchOrder(left, right) ||
      left.leftItem.labelCode.localeCompare(right.leftItem.labelCode) ||
      left.rightItem.labelCode.localeCompare(right.rightItem.labelCode)
  );
}
