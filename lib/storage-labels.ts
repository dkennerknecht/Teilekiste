function normalizeTrimmed(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

export function normalizeStorageShelfCode(value: string | null | undefined) {
  const normalized = normalizeTrimmed(value);
  return normalized ? normalized.toUpperCase() : null;
}

export function isManagedStorageShelfCode(value: string | null | undefined) {
  const normalized = normalizeStorageShelfCode(value);
  return normalized ? /^[A-Z]{2}$/.test(normalized) : false;
}

export function normalizeStorageBinCode(value: string | null | undefined) {
  const normalized = normalizeTrimmed(value);
  if (!normalized) return null;

  const upperCased = normalized.toUpperCase();
  if (/^\d{1,2}$/.test(upperCased)) {
    return String(Number.parseInt(upperCased, 10)).padStart(2, "0");
  }

  const legacyMatch = /^([A-Z]+)(\d+)$/.exec(upperCased);
  if (!legacyMatch) {
    return upperCased;
  }

  const [, prefix, digits] = legacyMatch;
  const parsedNumber = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsedNumber)) {
    return upperCased;
  }

  return `${prefix}${String(parsedNumber).padStart(2, "0")}`;
}

export function isManagedStorageBinCode(value: string | null | undefined) {
  const normalized = normalizeStorageBinCode(value);
  return normalized ? /^(0[1-9]|[1-9]\d)$/.test(normalized) : false;
}

export function getStorageBinCodeVariants(value: string | null | undefined) {
  const normalized = normalizeTrimmed(value);
  if (!normalized) return [];

  const upperCased = normalized.toUpperCase();
  if (/^\d{1,2}$/.test(upperCased)) {
    const parsedNumber = Number.parseInt(upperCased, 10);
    const unpadded = String(parsedNumber);
    const padded = String(parsedNumber).padStart(2, "0");
    return Array.from(new Set([upperCased, unpadded, padded]));
  }

  const legacyMatch = /^([A-Z]+)(\d+)$/.exec(upperCased);
  if (!legacyMatch) {
    return [upperCased];
  }

  const [, prefix, digits] = legacyMatch;
  const parsedNumber = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsedNumber)) {
    return [upperCased];
  }

  const unpadded = `${prefix}${String(parsedNumber)}`;
  const padded = `${prefix}${String(parsedNumber).padStart(2, "0")}`;

  return Array.from(new Set([upperCased, unpadded, padded]));
}

export function parseManagedStorageShelfLabel(value: string | null | undefined) {
  const normalized = normalizeStorageShelfCode(value);
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export function parseManagedStorageBinLabel(value: string | null | undefined) {
  const normalized = normalizeStorageBinCode(value);
  return normalized && /^(0[1-9]|[1-9]\d)$/.test(normalized) ? normalized : null;
}

export function parseManagedDrawerLabel(value: string | null | undefined) {
  const normalized = normalizeStorageShelfCode(value);
  if (!normalized) return null;
  const match = /^([A-Z]{2})(0[1-9]|[1-9]\d)$/.exec(normalized);
  if (!match) return null;
  return {
    shelfCode: match[1],
    binCode: match[2]
  };
}

export function formatStorageShelfLabel(code: string | null | undefined, fallbackName?: string | null) {
  return normalizeStorageShelfCode(code) || normalizeTrimmed(fallbackName) || null;
}

export function formatStorageBinLabel(input: {
  shelfCode?: string | null;
  binCode?: string | null;
}) {
  const shelfCode = normalizeStorageShelfCode(input.shelfCode);
  const binCode = normalizeStorageBinCode(input.binCode);
  if (!binCode) return null;
  if (isManagedStorageShelfCode(shelfCode) && isManagedStorageBinCode(binCode)) {
    return `${shelfCode}${binCode}`;
  }
  return binCode;
}

export function formatDrawerPosition(
  code: string | null | undefined,
  slot: number | null | undefined,
  slotCount?: number | null,
  shelfCode?: string | null
) {
  const base = formatStorageBinLabel({ shelfCode, binCode: code });
  if (!base) return null;
  if ((slotCount ?? null) !== null && Number(slotCount) <= 1) {
    return base;
  }
  return slot ? `${base}-${slot}` : base;
}
