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

export function summarizeAuditEntry(entry: AuditLike) {
  const before = safeParseJson(entry.before);
  const after = safeParseJson(entry.after);

  switch (entry.action) {
    case "ITEM_CREATE":
      return "Item angelegt";
    case "ITEM_UPDATE":
      return summarizeDiff(before, after);
    case "ITEM_SOFT_DELETE":
      return "Item in den Papierkorb verschoben";
    case "ITEM_ARCHIVE":
      return "Item archiviert";
    case "ITEM_UNARCHIVE":
      return "Item aus dem Archiv wiederhergestellt";
    case "STOCK_MOVEMENT": {
      const previous = typeof before?.stock === "number" ? before.stock : null;
      const next = typeof after?.stock === "number" ? after.stock : null;
      const delta = typeof after?.delta === "number" ? after.delta : null;
      if (previous !== null && next !== null) {
        return `Bestand ${previous} -> ${next}${delta !== null ? ` (${delta > 0 ? `+${delta}` : delta})` : ""}`;
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
      const base = qty !== null && reservedFor ? `Reservierung angelegt: ${qty} x ${reservedFor}` : "Reservierung angelegt";
      return note ? `${base} (${note})` : base;
    }
    case "RESERVATION_DELETE": {
      const qty = typeof before?.reservedQty === "number" ? before.reservedQty : null;
      const reservedFor = String(before?.reservedFor || "").trim();
      const note = String(before?.note || "").trim();
      const base = qty !== null && reservedFor ? `Reservierung aufgehoben: ${qty} x ${reservedFor}` : "Reservierung aufgehoben";
      return note ? `${base} (${note})` : base;
    }
    default:
      return `${entry.action} auf ${entry.entity}`;
  }
}
