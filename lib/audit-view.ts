import { formatDisplayQuantity, serializeStoredQuantity } from "@/lib/quantity";

type AuditLike = {
  action: string;
  entity: string;
  entityId: string;
  before?: string | null;
  after?: string | null;
};

function safeParseJson(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function humanFieldName(field: string) {
  const labels: Record<string, string> = {
    labelCode: "Label-Code",
    name: "Name",
    description: "Beschreibung",
    categoryId: "Kategorie",
    storageLocationId: "Lagerort",
    storageArea: "Regal",
    bin: "Fach",
    stock: "Bestand",
    minStock: "Mindestbestand",
    manufacturer: "Hersteller",
    mpn: "MPN",
    isArchived: "Archiviert",
    qty: "Menge",
    childItemId: "Komponente"
  };
  return labels[field] || field;
}

function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const keys = new Set<string>([
    ...Object.keys(before || {}),
    ...Object.keys(after || {})
  ]);

  return Array.from(keys).filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]));
}

function summarizeDiff(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const fields = changedFields(before, after).slice(0, 4);
  if (!fields.length) return "Änderung gespeichert";
  return `Geändert: ${fields.map(humanFieldName).join(", ")}`;
}

function formatStoragePlace(payload: Record<string, unknown> | null) {
  if (!payload) return "Unbekannt";
  const location = String(payload.storageLocationName || payload.storageLocationId || "").trim() || "Unbekannt";
  const storageArea = String(payload.storageArea || "").trim();
  const bin = String(payload.bin || "").trim();
  return [location, storageArea || null, bin || null].filter(Boolean).join(" / ");
}

export function summarizeAuditEntry(entry: AuditLike) {
  const before = safeParseJson(entry.before);
  const after = safeParseJson(entry.after);
  const quantityUnit = String(after?.unit || before?.unit || "").trim() || null;

  function formatStoredAuditQuantity(value: unknown) {
    if (typeof value !== "number") return null;
    if (!quantityUnit) return String(value);
    return formatDisplayQuantity(quantityUnit, serializeStoredQuantity(quantityUnit, value));
  }

  switch (entry.action) {
    case "ITEM_CREATE":
      return "Item angelegt";
    case "ITEM_UPDATE":
      return summarizeDiff(before, after);
    case "ITEM_TRANSFER": {
      const from = formatStoragePlace(before);
      const to = formatStoragePlace(after);
      const note = String(after?.note || before?.note || "").trim();
      const base = `Umlagerung: ${from} -> ${to}`;
      return note ? `${base} (${note})` : base;
    }
    case "INVENTORY_SESSION_CREATE": {
      const scope = formatStoragePlace({
        storageLocationName: String(after?.storageLocationName || after?.storageLocationId || "Unbekannt"),
        storageArea: String(after?.storageArea || ""),
        bin: null
      });
      return `Inventur-Session angelegt: ${scope}`;
    }
    case "INVENTORY_SESSION_FINALIZE": {
      const scope = String(after?.scopeLabel || "Unbekannt");
      const countedRows = typeof after?.countedRows === "number" ? after.countedRows : null;
      return countedRows !== null
        ? `Inventur-Session finalisiert: ${scope} (${countedRows} gezaehlte Positionen)`
        : `Inventur-Session finalisiert: ${scope}`;
    }
    case "INVENTORY_SESSION_CANCEL": {
      const scope = String(after?.scopeLabel || "Unbekannt");
      return `Inventur-Session abgebrochen: ${scope}`;
    }
    case "ITEM_SOFT_DELETE":
      return "Item in den Papierkorb verschoben";
    case "ITEM_ARCHIVE":
      return "Item archiviert";
    case "ITEM_UNARCHIVE":
      return "Item aus dem Archiv wiederhergestellt";
    case "ITEM_MERGE": {
      const sourceLabel = String(before?.sourceLabelCode || after?.sourceLabelCode || "Quelle");
      const targetLabel = String(before?.targetLabelCode || after?.targetLabelCode || "Ziel");
      return `Items zusammengefuehrt: ${sourceLabel} -> ${targetLabel}`;
    }
    case "STOCK_MOVEMENT": {
      const previous = typeof before?.stock === "number" ? before.stock : null;
      const next = typeof after?.stock === "number" ? after.stock : null;
      const delta = typeof after?.delta === "number" ? after.delta : null;
      if (previous !== null && next !== null) {
        const previousText = formatStoredAuditQuantity(previous);
        const nextText = formatStoredAuditQuantity(next);
        const deltaText = formatStoredAuditQuantity(delta);
        return `Bestand ${previousText} -> ${nextText}${deltaText ? ` (${delta > 0 ? "+" : ""}${deltaText})` : ""}`;
      }
      return "Bestandsbuchung erfasst";
    }
    case "BOM_UPSERT": {
      const childLabel = String(after?.childLabelCode || before?.childLabelCode || "Komponente");
      const qty = after && typeof after.qty === "number" ? after.qty : null;
      return qty !== null
        ? `Stückliste aktualisiert: ${childLabel} x ${qty}`
        : `Stückliste aktualisiert: ${childLabel}`;
    }
    case "BOM_REMOVE": {
      const childLabel = String(before?.childLabelCode || "Komponente");
      return `Stückliste entfernt: ${childLabel}`;
    }
    case "RESERVATION_CREATE": {
      const qty = typeof after?.reservedQty === "number" ? after.reservedQty : null;
      const reservedFor = String(after?.reservedFor || "").trim();
      const note = String(after?.note || "").trim();
      const qtyText = formatStoredAuditQuantity(qty);
      const base = qtyText && reservedFor ? `Reservierung angelegt: ${qtyText} fuer ${reservedFor}` : "Reservierung angelegt";
      return note ? `${base} (${note})` : base;
    }
    case "RESERVATION_DELETE": {
      const qty = typeof before?.reservedQty === "number" ? before.reservedQty : null;
      const reservedFor = String(before?.reservedFor || "").trim();
      const note = String(before?.note || "").trim();
      const qtyText = formatStoredAuditQuantity(qty);
      const base = qtyText && reservedFor ? `Reservierung aufgehoben: ${qtyText} fuer ${reservedFor}` : "Reservierung aufgehoben";
      return note ? `${base} (${note})` : base;
    }
    default:
      return `${entry.action} auf ${entry.entity}`;
  }
}
