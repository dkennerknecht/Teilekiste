"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  FolderOpen,
  Layers,
  Tag,
  User,
  Trash2,
  PencilLine,
  Save,
  X,
  MapPin,
  Package2,
  Minus,
  Plus,
  RotateCcw
} from "lucide-react";
import { ItemImageGallery } from "@/components/item-image-gallery";
import { ItemAuditSection } from "@/components/item-audit-section";
import { CustomFieldsEditor } from "@/components/custom-fields-editor";
import { buildCustomValueMap, formatCustomFieldValue, parseStoredCustomFieldValue, type CustomFieldRow } from "@/lib/custom-fields";
import { formatDisplayQuantity, getQuantityStep, getUnitDisplayLabel } from "@/lib/quantity";

type TagOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; code?: string | null };
type LocationOption = { id: string; name: string; code?: string | null };
type ShelfOption = { id: string; name: string; storageLocationId: string };
type TypeOption = { id: string; code: string; name: string };
type TransferFormState = {
  storageLocationId: string;
  storageArea: string;
  bin: string;
  note: string;
};

const movementReasonOptions = [
  { value: "PURCHASE", label: "Einkauf" },
  { value: "CONSUMPTION", label: "Verbrauch" },
  { value: "CORRECTION", label: "Korrektur" },
  { value: "INVENTORY", label: "Inventur" },
  { value: "RESERVATION", label: "Reservierung" }
] as const;

function getMovementReasonLabel(reason: string) {
  return movementReasonOptions.find((entry) => entry.value === reason)?.label || reason;
}

function buildItemFormState(data: any) {
  return {
    name: data.name || "",
    description: data.description || "",
    categoryId: data.categoryId || "",
    storageLocationId: data.storageLocationId || "",
    storageArea: data.storageArea || "",
    bin: data.bin || "",
    minStock: data.minStock ?? "",
    manufacturer: data.manufacturer || "",
    mpn: data.mpn || "",
    tagIds: (data.tags || []).map((t: any) => t.tagId),
    typeId: data.typeId || "",
    customValues: buildCustomValueMap(data.customValues || [])
  };
}

function buildTransferFormState(data: any): TransferFormState {
  return {
    storageLocationId: data.storageLocationId || "",
    storageArea: data.storageArea || "",
    bin: data.bin || "",
    note: ""
  };
}

function formatStoragePlace(data: {
  storageLocation?: { name?: string | null } | null;
  storageArea?: string | null;
  bin?: string | null;
}) {
  return [data.storageLocation?.name || null, data.storageArea || null, data.bin || null].filter(Boolean).join(" / ") || "-";
}

export default function ItemDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [transferForm, setTransferForm] = useState<TransferFormState>({
    storageLocationId: "",
    storageArea: "",
    bin: "",
    note: ""
  });
  const [tags, setTags] = useState<TagOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [types, setTypes] = useState<TypeOption[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([]);
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState("PURCHASE");
  const [note, setNote] = useState("");
  const [reservedQty, setReservedQty] = useState(1);
  const [reservedFor, setReservedFor] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/items/${params.id}`, { cache: "no-store" });
    const data = await res.json();
    if (data?.redirectToItemId) {
      router.replace(`/items/${data.redirectToItemId}`);
      return;
    }
    setItem(data);
    setForm(buildItemFormState(data));
    setTransferForm(buildTransferFormState(data));
  }, [params.id, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/meta", { cache: "no-store" })
      .then((r) => r.json())
      .then((meta) => {
        setTags(meta.tags || []);
        setCategories(meta.categories || []);
        setLocations(meta.locations || []);
        setShelves(meta.shelves || []);
        setTypes(meta.types || []);
        setCustomFields(meta.customFields || []);
      });
  }, []);

  useEffect(() => {
    if (!editMode || !item || !types.length) return;
    if (form.typeId) return;

    const parts = String(item.labelCode || "").split("-");
    if (parts.length < 2) return;
    const typeCode = parts[parts.length - 2];
    const type = types.find((t) => t.code === typeCode);
    if (!type) return;
    setForm((prev: any) => ({
      ...prev,
      typeId: type.id
    }));
  }, [editMode, item, types, form?.typeId]);

  const history = useMemo(() => {
    if (!item) return [];
    const movements = (item.movements || []).map((m: any) => ({
      id: `m-${m.id}`,
      createdAt: m.createdAt,
      text: `${m.delta > 0 ? `+${formatDisplayQuantity(item.unit, m.delta)}` : formatDisplayQuantity(item.unit, m.delta)} (${getMovementReasonLabel(m.reason)}) ${m.note || ""}`.trim()
    }));
    const reservationCreateIds = new Set(
      (item.reservationHistoryEntries || [])
        .filter((entry: any) => entry.action === "RESERVATION_CREATE" && entry.reservationId)
        .map((entry: any) => entry.reservationId)
    );
    const reservationHistoryEntries = (item.reservationHistoryEntries || []).map((entry: any) => ({
      id: `ra-${entry.id}`,
      createdAt: entry.createdAt,
      text: entry.text
    }));
    const legacyReservations = (item.reservations || [])
      .filter((reservation: any) => !reservationCreateIds.has(reservation.id))
      .map((reservation: any) => ({
        id: `r-${reservation.id}`,
        createdAt: reservation.createdAt,
        text: `Reservierung: ${formatDisplayQuantity(item.unit, reservation.reservedQty)} fuer ${reservation.reservedFor}`
      }));
    return [...movements, ...reservationHistoryEntries, ...legacyReservations].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [item]);

  const availableShelves = useMemo(() => {
    const currentLocationId = form?.storageLocationId || "";
    const currentStorageArea = form?.storageArea || "";
    const filtered = shelves.filter((shelf) => shelf.storageLocationId === currentLocationId);
    if (!currentStorageArea || filtered.some((shelf) => shelf.name === currentStorageArea)) {
      return filtered;
    }
    return [{ id: `legacy-${currentStorageArea}`, name: currentStorageArea, storageLocationId: currentLocationId }, ...filtered];
  }, [form?.storageArea, form?.storageLocationId, shelves]);

  const availableTransferShelves = useMemo(() => {
    const currentLocationId = transferForm.storageLocationId || "";
    const currentStorageArea = transferForm.storageArea || "";
    const filtered = shelves.filter((shelf) => shelf.storageLocationId === currentLocationId);
    if (!currentStorageArea || filtered.some((shelf) => shelf.name === currentStorageArea)) {
      return filtered;
    }
    return [{ id: `legacy-transfer-${currentStorageArea}`, name: currentStorageArea, storageLocationId: currentLocationId }, ...filtered];
  }, [shelves, transferForm.storageArea, transferForm.storageLocationId]);

  const itemCustomValues = useMemo(
    () =>
      (item?.customValues || []).filter((entry: any) => {
        const parsed = parseStoredCustomFieldValue(entry.valueJson);
        return !(parsed === null || parsed === undefined || parsed === "" || (Array.isArray(parsed) && parsed.length === 0));
      }),
    [item]
  );

  if (!item || !form) return <p>Lade...</p>;

  const owner = item.movements?.[0]?.user?.name || item.movements?.[0]?.user?.email || "-";
  const displayName = String((editMode ? form.name : item.name) || item.name || "Item").trim() || "Item";
  const showGallery = editMode || (item.images || []).length > 0;
  const hasDescription = Boolean(String(item.description || "").trim());
  const hasManufacturer = Boolean(String(item.manufacturer || "").trim());
  const hasMpn = Boolean(String(item.mpn || "").trim());
  const hasStorageArea = Boolean(String(item.storageArea || "").trim());
  const hasBin = Boolean(String(item.bin || "").trim());
  const hasTags = (item.tags || []).length > 0;
  const hasCustomFieldValues = itemCustomValues.length > 0;
  const currentStoragePlace = formatStoragePlace(item);
  const targetStoragePlace = [
    locations.find((location) => location.id === transferForm.storageLocationId)?.name || null,
    transferForm.storageArea || null,
    transferForm.bin || null
  ]
    .filter(Boolean)
    .join(" / ");

  async function quickStockAdjust(deltaValue: number) {
    await fetch(`/api/items/${item.id}/movements`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        delta: deltaValue,
        reason: deltaValue > 0 ? "PURCHASE" : "CONSUMPTION",
        note: "Quick adjust"
      })
    });
    await load();
  }

  async function createTagInEdit() {
    const name = newTagName.trim();
    if (!name) return;
    setCreatingTag(true);
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name })
    });
    const data = await res.json().catch(() => null);
    setCreatingTag(false);
    if (!res.ok || !data?.id) return;

    setTags((prev) => (prev.some((t) => t.id === data.id) ? prev : [...prev, data].sort((a, b) => a.name.localeCompare(b.name))));
    setForm((prev: any) => ({
      ...prev,
      tagIds: prev.tagIds.includes(data.id) ? prev.tagIds : [...prev.tagIds, data.id]
    }));
    setNewTagName("");
  }

  async function setArchiveState(nextArchived: boolean) {
    setArchiveBusy(true);
    setArchiveError("");
    setDeleteError("");

    const res = await fetch("/api/items/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        itemIds: [item.id],
        ...(nextArchived ? { archiveItems: true } : { unarchiveItems: true })
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setArchiveError(data?.error || "Der Archiv-Status konnte nicht aktualisiert werden.");
      setArchiveBusy(false);
      return;
    }

    setEditMode(false);
    setArchiveBusy(false);
    await load();
  }

  async function deleteItem() {
    if (deleteBusy) return;
    const confirmed = window.confirm("Item in den Papierkorb verschieben?");
    if (!confirmed) return;

    setDeleteBusy(true);
    setDeleteError("");
    setArchiveError("");
    setSaveError("");

    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setDeleteError(data?.error || "Loeschen fehlgeschlagen.");
        setDeleteBusy(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setDeleteError("Loeschen fehlgeschlagen.");
      setDeleteBusy(false);
    }
  }

  async function submitTransfer() {
    if (!transferForm.storageLocationId) {
      setTransferError("Bitte einen Ziel-Lagerort auswaehlen.");
      return;
    }

    setTransferBusy(true);
    setTransferError("");

    try {
      const res = await fetch(`/api/items/${item.id}/transfer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storageLocationId: transferForm.storageLocationId,
          storageArea: transferForm.storageArea.trim() || null,
          bin: transferForm.bin.trim() || null,
          note: transferForm.note.trim() || null
        })
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setTransferError(data?.error || "Umlagerung fehlgeschlagen.");
        return;
      }

      if (!data?.transferred) {
        setTransferError("Item befindet sich bereits an diesem Platz.");
        return;
      }

      await load();
    } catch {
      setTransferError("Umlagerung fehlgeschlagen.");
    } finally {
      setTransferBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-[var(--app-text)]">
      <div className="rounded-xl border border-workshop-200 bg-workshop-50 px-3 py-3 sm:px-4">
        <div className="grid grid-cols-[auto,1fr,auto] items-start gap-3 sm:gap-4">
          <button
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-workshop-300 bg-[var(--app-surface)] text-workshop-800 shadow-sm transition-colors hover:bg-[var(--app-surface-alt)] sm:h-14 sm:w-14"
            onClick={() => window.history.back()}
            aria-label="Zurueck"
          >
            <ArrowLeft size={30} />
          </button>

          <div className="min-w-0">
            <p className="theme-muted text-sm">Inventar / {item.category?.name || "Item"}</p>
            <h1 className="mt-1 break-words text-2xl font-semibold leading-tight text-[var(--app-text)] sm:text-4xl">
              {displayName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-workshop-300 bg-[var(--app-surface)] px-3 py-1 text-sm font-medium text-[var(--app-text)]">
                {item.labelCode}
              </span>
              <span className="theme-muted text-sm">{editMode ? "Item bearbeiten" : "Item Details"}</span>
            </div>
            {item.isArchived && (
              <span className="theme-status-warning mt-2 inline-flex rounded-full border border-transparent px-3 py-1 text-xs font-medium">
                Archiviert
              </span>
            )}
          </div>

          <div className={`flex shrink-0 flex-col gap-2 justify-self-end ${editMode ? "sm:flex-row" : ""}`}>
            {editMode ? (
              <>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-workshop-300 bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text)]"
                  onClick={() => {
                    setEditMode(false);
                    setSaveError("");
                    setForm(buildItemFormState(item));
                  }}
                >
                  <X size={16} /> Abbrechen
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--app-primary)] px-4 py-2 text-sm font-medium text-[var(--app-on-primary)]"
                  disabled={saveBusy}
                  onClick={async () => {
                    setSaveBusy(true);
                    setSaveError("");
                    try {
                      const selectedCategory = categories.find((c) => c.id === form.categoryId);
                      const selectedType = types.find((t) => t.id === form.typeId);
                      const shouldSendTypeId =
                        !!selectedType &&
                        (selectedType.id !== item.typeId || form.categoryId !== item.categoryId || !item.typeId);
                      const payload = {
                        name: form.name,
                        description: form.description,
                        categoryId: form.categoryId,
                        storageLocationId: form.storageLocationId,
                        storageArea: form.storageArea,
                        bin: form.bin,
                        manufacturer: form.manufacturer,
                        mpn: form.mpn,
                        tagIds: form.tagIds,
                        minStock: form.minStock === "" ? null : Number(form.minStock),
                        customValues: form.customValues,
                        ...(shouldSendTypeId ? { typeId: selectedType.id } : {})
                      };
                      const res = await fetch(`/api/items/${item.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify(payload)
                      });
                      if (res.ok) {
                        setEditMode(false);
                        await load();
                        return;
                      }
                      const data = await res.json().catch(() => null);
                      setSaveError(data?.error || "Speichern fehlgeschlagen.");
                    } catch {
                      setSaveError("Speichern fehlgeschlagen.");
                    } finally {
                      setSaveBusy(false);
                    }
                  }}
                >
                  <Save size={16} /> {saveBusy ? "Speichert..." : "Speichern"}
                </button>
              </>
            ) : (
              <>
                <button
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-workshop-300 bg-[var(--app-surface)] text-[var(--app-text)] sm:h-12 sm:w-12"
                  onClick={() => setArchiveState(!item.isArchived)}
                  disabled={archiveBusy || deleteBusy}
                  aria-label={item.isArchived ? "Wiederherstellen" : "Archivieren"}
                  title={item.isArchived ? "Wiederherstellen" : "Archivieren"}
                >
                  {item.isArchived ? <RotateCcw size={18} /> : <Archive size={18} />}
                </button>
                <button
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--app-primary)] text-[var(--app-on-primary)] sm:h-12 sm:w-12"
                  onClick={() => setEditMode(true)}
                  disabled={deleteBusy}
                  aria-label="Bearbeiten"
                  title="Bearbeiten"
                >
                  <PencilLine size={18} />
                </button>
                <button
                  className="theme-status-danger inline-flex h-11 w-11 items-center justify-center rounded-xl border border-transparent sm:h-12 sm:w-12"
                  onClick={deleteItem}
                  disabled={deleteBusy}
                  aria-label="Loeschen"
                  title="Loeschen"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>
        {archiveError && <p className="mt-3 text-sm text-red-700">{archiveError}</p>}
        {deleteError && <p className="mt-3 text-sm text-red-700">{deleteError}</p>}
        {saveError && <p className="mt-3 text-sm text-red-700">{saveError}</p>}
      </div>

      <div className={`grid gap-6 ${showGallery ? "lg:grid-cols-[1fr_1.4fr]" : ""}`}>
        {showGallery && (
          <section>
            <ItemImageGallery
              itemId={item.id}
              itemName={item.name}
              images={item.images || []}
              editMode={editMode}
              onReload={load}
            />
          </section>
        )}

        <section className="space-y-3">
          <div className="theme-muted grid grid-cols-1 gap-2 rounded-xl border border-workshop-200 bg-workshop-50 p-3 text-sm sm:text-[16px] md:grid-cols-3">
            <div className="inline-flex items-center gap-2"><CalendarDays size={15} /> Erstellt: {new Date(item.createdAt).toLocaleDateString("de-DE")}</div>
            <div className="inline-flex items-center gap-2"><CalendarDays size={15} /> Zuletzt bearbeitet: {new Date(item.updatedAt).toLocaleDateString("de-DE")}</div>
            <div className="inline-flex items-center gap-2"><User size={15} /> von {owner}</div>
          </div>

          <div className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-4">
            <div className="mb-4 border-b border-workshop-200 pb-4">
              <h2 className="inline-flex items-center gap-2 text-[26px] font-semibold text-[var(--app-text)] sm:text-[34px]"><FolderOpen size={18} /> Details</h2>
              <p className="mt-2 break-words text-xl font-semibold text-[var(--app-text)] sm:text-2xl">{displayName}</p>
              <p className="theme-muted mt-1 text-sm font-mono">{item.labelCode}</p>
            </div>

            <div className="space-y-4 text-[var(--app-text)]">
              {editMode && (
              <div>
                <p className="theme-muted mb-1 text-[18px] font-medium">Name</p>
                <input className="input text-lg" value={form.name} onChange={(e) => setForm((v: any) => ({ ...v, name: e.target.value }))} />
              </div>
              )}

              <div>
                <p className="theme-muted mb-1 text-[18px] font-medium"># ID</p>
                {editMode ? (
                  <div className="space-y-2">
                    <p className="text-xl font-mono">{item.labelCode}</p>
                    <p className="theme-muted text-sm">Wird automatisch neu vergeben, wenn Kategorie oder Type geaendert werden.</p>
                  </div>
                ) : (
                  <p className="text-xl font-mono">{item.labelCode}</p>
                )}
              </div>

              {editMode && (
                <div className="grid gap-4 border-t border-workshop-200 pt-4 md:grid-cols-2">
                  <div>
                    <p className="theme-muted mb-1 text-[18px] font-medium">Hersteller</p>
                    <input className="input" value={form.manufacturer} onChange={(e) => setForm((v: any) => ({ ...v, manufacturer: e.target.value }))} />
                  </div>
                  <div>
                    <p className="theme-muted mb-1 text-[18px] font-medium">MPN</p>
                    <input className="input" value={form.mpn} onChange={(e) => setForm((v: any) => ({ ...v, mpn: e.target.value }))} />
                  </div>
                </div>
              )}

              {(editMode || hasDescription) && (
                <div>
                  <p className="theme-muted mb-1 text-[18px] font-medium">Beschreibung</p>
                  {editMode ? (
                    <textarea className="input min-h-28" value={form.description} onChange={(e) => setForm((v: any) => ({ ...v, description: e.target.value }))} />
                  ) : (
                    <p className="whitespace-pre-wrap text-lg leading-8 text-[var(--app-text)]">{item.description}</p>
                  )}
                </div>
              )}

              <div className={`grid gap-4 border-t border-workshop-200 pt-4 ${editMode ? "md:grid-cols-2" : "md:grid-cols-2"}`}>
                <div>
                  <p className="theme-muted mb-1 inline-flex items-center gap-2 text-[18px] font-medium"><Layers size={15} /> Kategorie</p>
                  {editMode ? (
                    <select className="input" value={form.categoryId} onChange={(e) => setForm((v: any) => ({ ...v, categoryId: e.target.value }))}>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-lg font-medium text-[var(--app-text)]">{item.category?.name || "-"}</p>
                  )}
                </div>

                {editMode && (
                  <div>
                    <p className="theme-muted mb-1 text-[18px] font-medium">Type</p>
                    <select className="input" value={form.typeId} onChange={(e) => setForm((v: any) => ({ ...v, typeId: e.target.value }))}>
                      <option value="">Type (Label)</option>
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} - {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {!editMode && (hasManufacturer || hasMpn) && (
                <div className="grid gap-4 border-t border-workshop-200 pt-4 md:grid-cols-2">
                  {hasManufacturer && (
                    <div>
                      <p className="theme-muted mb-1 text-[18px] font-medium">Hersteller</p>
                      <p className="text-lg font-medium text-[var(--app-text)]">{item.manufacturer}</p>
                    </div>
                  )}

                  {hasMpn && (
                    <div>
                      <p className="theme-muted mb-1 text-[18px] font-medium">MPN</p>
                      <p className="text-lg font-mono text-[var(--app-text)]">{item.mpn}</p>
                    </div>
                  )}
                </div>
              )}

              {(editMode || item.storageLocation || hasStorageArea || hasBin) && (
                <div className={`grid gap-4 border-t border-workshop-200 pt-4 ${editMode ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
                  <div>
                    <p className="theme-muted mb-1 inline-flex items-center gap-2 text-[18px] font-medium"><MapPin size={15} /> Ort</p>
                    {editMode ? (
                      <select
                        className="input"
                        value={form.storageLocationId}
                        onChange={(e) => setForm((v: any) => ({ ...v, storageLocationId: e.target.value, storageArea: "" }))}
                      >
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name} ({location.code || "--"})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-lg font-medium text-[var(--app-text)]">{item.storageLocation?.name || "-"}</p>
                    )}
                  </div>

                  {(editMode || hasStorageArea) && (
                    <div>
                      <p className="theme-muted mb-1 text-[18px] font-medium">Regal / Bereich</p>
                      {editMode ? (
                        <select className="input" value={form.storageArea} onChange={(e) => setForm((v: any) => ({ ...v, storageArea: e.target.value }))}>
                          <option value="">{availableShelves.length ? "Kein Regal" : "Keine Regale fuer Lagerort"}</option>
                          {availableShelves.map((shelf) => (
                            <option key={shelf.id} value={shelf.name}>
                              {shelf.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-lg text-[var(--app-text)]">{item.storageArea}</p>
                      )}
                    </div>
                  )}
                  {(editMode || hasBin) && (
                    <div>
                      <p className="theme-muted mb-1 text-[18px] font-medium">Fach / Bin</p>
                      {editMode ? (
                        <input className="input" value={form.bin} onChange={(e) => setForm((v: any) => ({ ...v, bin: e.target.value }))} />
                      ) : (
                        <p className="text-lg text-[var(--app-text)]">{item.bin}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {editMode && (
                <p className="theme-muted border-t border-workshop-200 pt-4 text-sm">
                  Standortwechsel werden als Umlagerung protokolliert. Fuer schnelle Lagerwechsel ist der Transfer-Block unterhalb der Details der bevorzugte Weg.
                </p>
              )}

              {(editMode || hasTags) && (
                <div className="border-t border-workshop-200 pt-4">
                  <p className="theme-muted mb-2 inline-flex items-center gap-2 text-[18px] font-medium"><Tag size={15} /> Tags</p>
                  {editMode ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            className={`rounded-full border px-3 py-1 text-sm ${
                              form.tagIds.includes(tag.id)
                                ? "border-[var(--app-primary)] bg-[var(--app-primary)] text-[var(--app-on-primary)]"
                                : "border-workshop-200 bg-[var(--app-surface)] text-[var(--app-text)]"
                            }`}
                            onClick={() =>
                              setForm((prev: any) => ({
                                ...prev,
                                tagIds: prev.tagIds.includes(tag.id)
                                  ? prev.tagIds.filter((id: string) => id !== tag.id)
                                  : [...prev.tagIds, tag.id]
                              }))
                            }
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <input
                          className="input w-full sm:max-w-xs"
                          placeholder="Neuen Tag erstellen"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                        />
                        <button type="button" className="btn-secondary w-full sm:w-auto" onClick={createTagInEdit} disabled={creatingTag || !newTagName.trim()}>
                          {creatingTag ? "Anlegen..." : "Tag anlegen"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((t: any) => (
                        <span key={t.tag.id} className="rounded-full border border-workshop-200 bg-workshop-50 px-3 py-1 text-sm font-medium">
                          {t.tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(editMode || hasCustomFieldValues) && (
                <div className="border-t border-workshop-200 pt-4">
                  <p className="theme-muted mb-2 text-[18px] font-medium">Custom Fields</p>
                  {editMode ? (
                    <CustomFieldsEditor
                      fields={customFields}
                      values={form.customValues || {}}
                      categoryId={form.categoryId}
                      typeId={form.typeId}
                      onChange={(customValues) => setForm((prev: any) => ({ ...prev, customValues }))}
                    />
                  ) : (
                    <dl className="grid gap-3 md:grid-cols-2">
                      {itemCustomValues.map((entry: any) => {
                        const parsedValue = parseStoredCustomFieldValue(entry.valueJson);
                        return (
                          <div key={entry.id} className="rounded-lg border border-workshop-200 px-3 py-2">
                            <dt className="theme-muted text-sm">
                              {entry.customField?.name}
                              {entry.customField?.unit ? ` (${entry.customField.unit})` : ""}
                            </dt>
                            <dd className="font-medium text-[var(--app-text)]">
                              {formatCustomFieldValue(entry.customField, parsedValue)}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {!editMode && (
        <section className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="inline-flex items-center gap-2 text-2xl font-semibold text-[var(--app-text)]">
                <MapPin size={18} /> Umlagerung
              </h3>
              <p className="theme-muted mt-1 text-sm">Volltransfer des gesamten Items ohne Bestandsbuchung.</p>
            </div>
            <span className="rounded-full border border-workshop-200 bg-workshop-50 px-3 py-1 text-sm font-medium text-workshop-800">
              Aktuell: {currentStoragePlace}
            </span>
          </div>

          {transferError && <p className="theme-status-danger mb-3 rounded-lg border border-transparent px-3 py-2 text-sm">{transferError}</p>}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <label className="space-y-2 rounded-xl border border-workshop-200 p-3">
              <span className="text-sm font-medium">Ziel-Lagerort</span>
              <select
                className="input"
                value={transferForm.storageLocationId}
                onChange={(e) =>
                  setTransferForm((prev) => ({
                    ...prev,
                    storageLocationId: e.target.value,
                    storageArea: ""
                  }))
                }
              >
                <option value="">Lagerort waehlen</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.code || "--"})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 rounded-xl border border-workshop-200 p-3">
              <span className="text-sm font-medium">Ziel-Regal / Bereich</span>
              <select
                className="input"
                value={transferForm.storageArea}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, storageArea: e.target.value }))}
                disabled={!transferForm.storageLocationId}
              >
                <option value="">
                  {!transferForm.storageLocationId
                    ? "Erst Lagerort waehlen"
                    : availableTransferShelves.length
                      ? "Kein Regal"
                      : "Keine Regale fuer Lagerort"}
                </option>
                {availableTransferShelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.name}>
                    {shelf.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 rounded-xl border border-workshop-200 p-3">
              <span className="text-sm font-medium">Ziel-Fach / Bin</span>
              <input
                className="input"
                value={transferForm.bin}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, bin: e.target.value }))}
                placeholder="Leer = Fach entfernen"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <label className="space-y-2 rounded-xl border border-workshop-200 p-3">
              <span className="text-sm font-medium">Notiz</span>
              <textarea
                className="input min-h-24"
                value={transferForm.note}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Optional fuer Audit und Nachvollziehbarkeit"
              />
            </label>

            <div className="flex flex-col justify-between gap-3 rounded-xl border border-workshop-200 p-3">
              <div className="text-sm text-workshop-700">
                <p className="font-medium text-[var(--app-text)]">Ziel</p>
                <p>{targetStoragePlace || "Noch kein Ziel gewaehlt"}</p>
              </div>
              <button type="button" className="btn w-full" onClick={submitTransfer} disabled={transferBusy}>
                {transferBusy ? "Speichert..." : "Umlagerung ausfuehren"}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="inline-flex items-center gap-2 text-2xl font-semibold text-[var(--app-text)]"><Package2 size={18} /> Bestandsverwaltung</h3>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${item.isArchived ? "theme-status-warning" : "theme-status-success"}`}>
            {item.isArchived ? "Archiviert" : "Auf Lager"}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="theme-surface-tonal rounded-xl p-4 text-center">
            <p className="theme-muted text-sm">Gesamtbestand</p>
            <div className="mt-2 flex items-center justify-center gap-3">
              <button type="button" className="rounded-lg border border-workshop-300 bg-[var(--app-surface)] p-2" onClick={() => quickStockAdjust(-1)}>
                <Minus size={14} />
              </button>
              <span className="text-4xl font-semibold">{formatDisplayQuantity(item.unit, item.stock)}</span>
              <button type="button" className="rounded-lg border border-workshop-300 bg-[var(--app-surface)] p-2" onClick={() => quickStockAdjust(1)}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="theme-status-warning rounded-xl p-4 text-center">
            <p className="text-sm">Reserviert</p>
            <p className="mt-2 text-4xl font-semibold">{formatDisplayQuantity(item.unit, item.reservedQty)}</p>
          </div>

          <div className="theme-status-success rounded-xl p-4 text-center">
            <p className="text-sm">Verfügbar</p>
            <p className="mt-2 text-4xl font-semibold">{formatDisplayQuantity(item.unit, item.availableStock)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {editMode ? (
            <label className="block w-full sm:max-w-xs">
              <p className="theme-muted mb-1 text-lg">Mindestbestand</p>
              <input
                className="input"
                type="number"
                step={getQuantityStep(item.unit)}
                value={form.minStock}
                onChange={(e) => setForm((prev: any) => ({ ...prev, minStock: e.target.value }))}
                placeholder="leer = kein Mindestbestand"
              />
            </label>
          ) : (
            <p className="theme-muted text-lg">Mindestbestand: <b>{formatDisplayQuantity(item.unit, item.minStock)}</b></p>
          )}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <input
              className="input w-full sm:w-24"
              type="number"
              step={getQuantityStep(item.unit)}
              value={reservedQty}
              onChange={(e) => setReservedQty(Number(e.target.value))}
            />
            <input className="input w-full sm:min-w-[16rem] sm:flex-1" placeholder="Projekt/Person" value={reservedFor} onChange={(e) => setReservedFor(e.target.value)} />
            <button
              className="btn-secondary w-full sm:w-auto"
              onClick={async () => {
                await fetch(`/api/items/${item.id}/reservations`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ reservedQty, reservedFor })
                });
                setReservedFor("");
                await load();
              }}
            >
              Reservieren
            </button>
          </div>
        </div>

        <div className="mt-4 border-t border-workshop-200 pt-3">
          <p className="theme-muted mb-2 text-lg font-medium">Aktive Reservierungen</p>
          <ul className="space-y-2">
            {(item.reservations || []).map((r: any) => (
              <li key={r.id} className="flex flex-col gap-3 rounded-xl border border-workshop-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{r.reservedFor}</p>
                  <p className="theme-muted text-sm">{formatDisplayQuantity(item.unit, r.reservedQty)} • {new Date(r.createdAt).toLocaleDateString("de-DE")}</p>
                </div>
                <button
                  type="button"
                  className="theme-muted hover:text-[var(--app-text)]"
                  onClick={async () => {
                    await fetch(`/api/reservations/${r.id}`, { method: "DELETE" });
                    await load();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
            {item.reservations?.length === 0 && <li className="theme-muted text-sm">Keine aktiven Reservierungen</li>}
          </ul>
        </div>

        <div className="mt-4 border-t border-workshop-200 pt-3">
          <p className="mb-2 text-sm font-semibold">Bestandsbuchung</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <input
              className="input w-full sm:w-28"
              type="number"
              step={getQuantityStep(item.unit)}
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
            />
            <select className="input w-full sm:w-auto" value={reason} onChange={(e) => setReason(e.target.value)}>
              {movementReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input className="input w-full sm:min-w-[16rem] sm:flex-1" placeholder="Notiz" value={note} onChange={(e) => setNote(e.target.value)} />
            <button
              className="btn w-full sm:w-auto"
              onClick={async () => {
                await fetch(`/api/items/${item.id}/movements`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ delta, reason, note })
                });
                setDelta(1);
                await load();
              }}
            >
              Buchung erfassen ({getUnitDisplayLabel(item.unit)})
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-4">
        <h3 className="mb-3 text-lg font-semibold text-[var(--app-text)]">Historie</h3>
        <ul className="space-y-1 text-sm">
          {history.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-workshop-200 p-2">
              {new Date(entry.createdAt).toLocaleString("de-DE")}: {entry.text}
            </li>
          ))}
        </ul>
      </section>
      <ItemAuditSection entries={item.auditEntries || []} />
    </div>
  );
}
