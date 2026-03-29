export class QuantityValidationError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "QuantityValidationError";
    this.field = field;
  }
}

export function isMeterUnit(unit?: string | null) {
  return unit === "M";
}

export function getQuantityScale(unit?: string | null) {
  return isMeterUnit(unit) ? 1000 : 1;
}

export function getQuantityStep(unit?: string | null) {
  return isMeterUnit(unit) ? "0.001" : "1";
}

export function getUnitDisplayLabel(unit?: string | null) {
  if (unit === "STK") return "Stk";
  if (unit === "SET") return "Set";
  if (unit === "PACK") return "Pack";
  if (unit === "M") return "m";
  return unit || "";
}

function parseNumericInput(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function toStoredQuantity(
  unit: string,
  value: unknown,
  input?: {
    field?: string;
    allowNegative?: boolean;
    allowZero?: boolean;
    nullable?: boolean;
  }
) {
  const field = input?.field || "Menge";
  const nullable = !!input?.nullable;
  const allowNegative = !!input?.allowNegative;
  const allowZero = input?.allowZero !== false;
  const parsed = parseNumericInput(value);

  if (parsed === null) {
    if (nullable) return null;
    throw new QuantityValidationError(`${field} ist ungueltig`, field);
  }

  let stored: number;
  if (isMeterUnit(unit)) {
    stored = Math.round(parsed * getQuantityScale(unit));
  } else {
    if (!Number.isInteger(parsed)) {
      throw new QuantityValidationError(`${field} muss fuer ${getUnitDisplayLabel(unit)} ganzzahlig sein`, field);
    }
    stored = parsed;
  }

  if (!Number.isSafeInteger(stored)) {
    throw new QuantityValidationError(`${field} ist zu gross`, field);
  }
  if (!allowNegative && stored < 0) {
    throw new QuantityValidationError(`${field} darf nicht negativ sein`, field);
  }
  if (!allowZero && stored === 0) {
    throw new QuantityValidationError(`${field} darf nicht 0 sein`, field);
  }

  return stored;
}

export function fromStoredQuantity(unit: string, value: number | null | undefined) {
  if (value === null || value === undefined) return value;
  if (!isMeterUnit(unit)) return value;
  return Number((value / getQuantityScale(unit)).toFixed(3));
}

export function formatDisplayQuantityValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (!Number.isFinite(value)) return String(value);
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}

export function formatDisplayQuantity(unit: string, value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  const label = getUnitDisplayLabel(unit);
  return label ? `${formatDisplayQuantityValue(value)} ${label}` : formatDisplayQuantityValue(value);
}

export function serializeStoredQuantity(unit: string, value: number | null | undefined) {
  return fromStoredQuantity(unit, value) ?? null;
}
