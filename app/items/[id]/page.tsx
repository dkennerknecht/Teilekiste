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
import { useAppLanguage } from "@/components/app-language-provider";
import { translateApiErrorMessage } from "@/lib/app-language";
import { ItemImageGallery } from "@/components/item-image-gallery";
import { ItemAuditSection } from "@/components/item-audit-section";
import { CustomFieldsEditor } from "@/components/custom-fields-editor";
import { buildCustomValueMap, formatCustomFieldValue, parseStoredCustomFieldValue, type CustomFieldRow } from "@/lib/custom-fields";
import { formatDisplayQuantity, getQuantityStep, getUnitDisplayLabel } from "@/lib/quantity";
import { formatDrawerPosition, formatStorageBinLabel } from "@/lib/storage-labels";

type TagOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; code?: string | null };
type LocationOption = { id: string; name: string; code?: string | null };
type ShelfOption = { id: string; name: string; code?: string | null; mode?: string; storageLocationId: string };
type StorageBinOption = { id: string; code: string; fullCode?: string | null; storageLocationId: string; storageShelfId: string; slotCount: number; isActive?: boolean };
type TypeOption = { id: string; code: string; name: string };
type TransferFormState = {
  storageLocationId: string;
  storageShelfId: string;
  storageBinId: string;
  binSlot: string;
  note: string;
};

function getMovementReasonLabel(reason: string, tr: (de: string, en: string) => string) {
  if (reason === "PURCHASE") return tr("Einkauf", "Purchase");
  if (reason === "CONSUMPTION") return tr("Verbrauch", "Consumption");
  if (reason === "CORRECTION") return tr("Korrektur", "Correction");
  if (reason === "INVENTORY") return tr("Inventur", "Inventory");
  if (reason === "RESERVATION") return tr("Reservierung", "Reservation");
  return reason;
}

function buildItemFormState(data: any) {
  return {
    name: data.name || "",
    description: data.description || "",
    categoryId: data.categoryId || "",
    placementStatus: data.placementStatus || "PLACED",
    storageLocationId: data.storageLocationId || "",
    storageShelfId: data.storageShelfId || "",
    storageBinId: data.storageBinId || "",
    binSlot: data.binSlot ? String(data.binSlot) : "",
    minStock: data.minStock ?? "",
    incomingQty: data.incomingQty ?? 0,
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
    storageShelfId: data.storageShelfId || "",
    storageBinId: data.storageBinId || "",
    binSlot: data.binSlot ? String(data.binSlot) : "",
    note: ""
  };
}

function formatStoragePlace(data: {
  displayPosition?: string | null;
}) {
  return data.displayPosition || "-";
}

export default function ItemDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { language } = useAppLanguage();
  const locale = language === "en" ? "en-US" : "de-DE";
  const tr = useCallback((de: string, en: string) => (language === "en" ? en : de), [language]);
  const [item, setItem] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [transferForm, setTransferForm] = useState<TransferFormState>({
    storageLocationId: "",
    storageShelfId: "",
    storageBinId: "",
    binSlot: "",
    note: ""
  });
  const [tags, setTags] = useState<TagOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [bins, setBins] = useState<StorageBinOption[]>([]);
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
        setBins((meta.bins || []).filter((entry: StorageBinOption) => entry.isActive !== false));
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

  useEffect(() => {
    if (!editMode || !form?.storageBinId) return;
    const selectedBin = bins.find((entry) => entry.id === form.storageBinId);
    if (!selectedBin) return;
    setForm((prev: any) => {
      const nextBinSlot =
        selectedBin.slotCount <= 1
          ? ""
          : prev.binSlot && Number(prev.binSlot) <= selectedBin.slotCount
            ? prev.binSlot
            : "";
      return {
        ...prev,
        storageLocationId: selectedBin.storageLocationId,
        storageShelfId: selectedBin.storageShelfId,
        binSlot: nextBinSlot
      };
    });
  }, [bins, editMode, form?.storageBinId]);

  const history = useMemo(() => {
    if (!item) return [];
    const movements = (item.movements || []).map((m: any) => ({
      id: `m-${m.id}`,
      createdAt: m.createdAt,
      text: `${m.delta > 0 ? `+${formatDisplayQuantity(item.unit, m.delta)}` : formatDisplayQuantity(item.unit, m.delta)} (${getMovementReasonLabel(m.reason, tr)}) ${m.note || ""}`.trim()
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
        text: tr(`Reservierung: ${formatDisplayQuantity(item.unit, reservation.reservedQty)} fuer ${reservation.reservedFor}`, `Reservation: ${formatDisplayQuantity(item.unit, reservation.reservedQty)} for ${reservation.reservedFor}`)
      }));
    return [...movements, ...reservationHistoryEntries, ...legacyReservations].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [item, tr]);

  const availableShelves = useMemo(() => {
    const currentLocationId = form?.storageLocationId || "";
    const filtered = shelves.filter((shelf) => shelf.storageLocationId === currentLocationId);
    return filtered;
  }, [form?.storageLocationId, shelves]);

  const availableBins = useMemo(
    () => bins.filter((entry) => entry.storageShelfId === form?.storageShelfId),
    [bins, form?.storageShelfId]
  );

  const selectedShelf = useMemo(
    () => shelves.find((entry) => entry.id === form?.storageShelfId) || null,
    [form?.storageShelfId, shelves]
  );

  const selectedManagedBin = useMemo(
    () => bins.find((entry) => entry.id === form?.storageBinId) || null,
    [bins, form?.storageBinId]
  );
  const selectedManagedBinRequiresSlot = !!selectedManagedBin && selectedManagedBin.slotCount > 1;

  const availableTransferShelves = useMemo(() => {
    const currentLocationId = transferForm.storageLocationId || "";
    const filtered = shelves.filter((shelf) => shelf.storageLocationId === currentLocationId);
    return filtered;
  }, [shelves, transferForm.storageLocationId]);

  const selectedTransferShelf = useMemo(
    () => shelves.find((entry) => entry.id === transferForm.storageShelfId) || null,
    [shelves, transferForm.storageShelfId]
  );

  const availableTransferBins = useMemo(
    () => bins.filter((entry) => entry.storageShelfId === transferForm.storageShelfId),
    [bins, transferForm.storageShelfId]
  );
  const selectedTransferBin = useMemo(
    () => availableTransferBins.find((entry) => entry.id === transferForm.storageBinId) || null,
    [availableTransferBins, transferForm.storageBinId]
  );
  const selectedTransferBinRequiresSlot = !!selectedTransferBin && selectedTransferBin.slotCount > 1;

  function getBinLabel(bin: StorageBinOption | null | undefined, shelfCode?: string | null) {
    if (!bin) return "";
    return (
      bin.fullCode ||
      formatStorageBinLabel({
        shelfCode: shelfCode || shelves.find((entry) => entry.id === bin.storageShelfId)?.code || null,
        binCode: bin.code
      }) ||
      bin.code
    );
  }

  const itemCustomValues = useMemo(
    () =>
      (item?.customValues || []).filter((entry: any) => {
        const parsed = parseStoredCustomFieldValue(entry.valueJson);
        return !(parsed === null || parsed === undefined || parsed === "" || (Array.isArray(parsed) && parsed.length === 0));
      }),
    [item]
  );

  if (!item || !form) return <p>{tr("Lade...", "Loading...")}</p>;

  const owner = item.movements?.[0]?.user?.name || item.movements?.[0]?.user?.email || "-";
  const displayName = String((editMode ? form.name : item.name) || item.name || "Item").trim() || "Item";
  const showGallery = editMode || (item.images || []).length > 0;
  const hasDescription = Boolean(String(item.description || "").trim());
  const hasManufacturer = Boolean(String(item.manufacturer || "").trim());
  const hasMpn = Boolean(String(item.mpn || "").trim());
  const hasPlacement = Boolean(String(item.displayPosition || "").trim());
  const hasIncomingQty = Number(item.incomingQty || 0) > 0;
  const isPlaced = form.placementStatus === "PLACED";
  const selectedPlacementShelf = selectedShelf;
  const usesManagedDrawer = isPlaced && selectedPlacementShelf?.mode === "DRAWER_HOST";
  const hasTags = (item.tags || []).length > 0;
  const hasCustomFieldValues = itemCustomValues.length > 0;
  const currentStoragePlace = formatStoragePlace(item);
  const targetStoragePlace = [
    locations.find((location) => location.id === transferForm.storageLocationId)?.name || null,
    selectedTransferShelf ? [selectedTransferShelf.code, selectedTransferShelf.name].filter(Boolean).join(" - ") : null,
    selectedTransferBin
      ? formatDrawerPosition(
          selectedTransferBin.code,
          transferForm.binSlot ? Number(transferForm.binSlot) : null,
          selectedTransferBin.slotCount,
          selectedTransferShelf?.code || null
        )
      : null
  ]
    .filter(Boolean)
    .join(" / ");
  const movementReasonOptions = [
    { value: "PURCHASE", label: tr("Einkauf", "Purchase") },
    { value: "CONSUMPTION", label: tr("Verbrauch", "Consumption") },
    { value: "CORRECTION", label: tr("Korrektur", "Correction") },
    { value: "INVENTORY", label: tr("Inventur", "Inventory") },
    { value: "RESERVATION", label: tr("Reservierung", "Reservation") }
  ];

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
      setArchiveError(translateApiErrorMessage(language, data?.error) || tr("Der Archiv-Status konnte nicht aktualisiert werden.", "Archive status could not be updated."));
      setArchiveBusy(false);
      return;
    }

    setEditMode(false);
    setArchiveBusy(false);
    await load();
  }

  async function deleteItem() {
    if (deleteBusy) return;
    const confirmed = window.confirm(tr("Item in den Papierkorb verschieben?", "Move item to trash?"));
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
        setDeleteError(translateApiErrorMessage(language, data?.error) || tr("Loeschen fehlgeschlagen.", "Delete failed."));
        setDeleteBusy(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setDeleteError(tr("Loeschen fehlgeschlagen.", "Delete failed."));
      setDeleteBusy(false);
    }
  }

  async function submitTransfer() {
    if (!transferForm.storageLocationId) {
      setTransferError(tr("Bitte einen Ziel-Lagerort auswaehlen.", "Please choose a target storage location."));
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
          storageShelfId: transferForm.storageShelfId || null,
          storageBinId: transferForm.storageBinId || null,
          binSlot: transferForm.storageBinId && transferForm.binSlot ? Number(transferForm.binSlot) : null,
          note: transferForm.note.trim() || null
        })
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setTransferError(translateApiErrorMessage(language, data?.error) || tr("Umlagerung fehlgeschlagen.", "Transfer failed."));
        return;
      }

      if (!data?.transferred) {
        setTransferError(tr("Item befindet sich bereits an diesem Platz.", "Item is already at this location."));
        return;
      }

      await load();
    } catch {
      setTransferError(tr("Umlagerung fehlgeschlagen.", "Transfer failed."));
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
            aria-label={tr("Zurueck", "Back")}
          >
            <ArrowLeft size={30} />
          </button>

          <div className="min-w-0">
            <p className="theme-muted text-sm">{tr("Inventar", "Inventory")} / {item.category?.name || tr("Item", "Item")}</p>
            <h1 className="mt-1 break-words text-2xl font-semibold leading-tight text-[var(--app-text)] sm:text-4xl">
              {displayName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-workshop-300 bg-[var(--app-surface)] px-3 py-1 text-sm font-medium text-[var(--app-text)]">
                {item.labelCode}
              </span>
              <span className="theme-muted text-sm">{editMode ? tr("Item bearbeiten", "Edit item") : tr("Item-Details", "Item details")}</span>
            </div>
            {item.isArchived && (
              <span className="theme-status-warning mt-2 inline-flex rounded-full border border-transparent px-3 py-1 text-xs font-medium">
                {tr("Archiviert", "Archived")}
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
                  <X size={16} /> {tr("Abbrechen", "Cancel")}
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
                        placementStatus: form.placementStatus,
                        storageLocationId: isPlaced ? form.storageLocationId || null : null,
                        storageShelfId: isPlaced ? form.storageShelfId || null : null,
                        storageBinId: usesManagedDrawer ? form.storageBinId || null : null,
                        binSlot: usesManagedDrawer && form.binSlot ? Number(form.binSlot) : null,
                        manufacturer: form.manufacturer,
                        mpn: form.mpn,
                        tagIds: form.tagIds,
                        minStock: form.minStock === "" ? null : Number(form.minStock),
                        incomingQty: Number(form.incomingQty || 0),
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
                      setSaveError(translateApiErrorMessage(language, data?.error) || tr("Speichern fehlgeschlagen.", "Save failed."));
                    } catch {
                      setSaveError(tr("Speichern fehlgeschlagen.", "Save failed."));
                    } finally {
                      setSaveBusy(false);
                    }
                  }}
                >
                  <Save size={16} /> {saveBusy ? tr("Speichert...", "Saving...") : tr("Speichern", "Save")}
                </button>
              </>
            ) : (
              <>
                <button
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-workshop-300 bg-[var(--app-surface)] text-[var(--app-text)] sm:h-12 sm:w-12"
                  onClick={() => setArchiveState(!item.isArchived)}
                  disabled={archiveBusy || deleteBusy}
                  aria-label={item.isArchived ? tr("Wiederherstellen", "Restore") : tr("Archivieren", "Archive")}
                  title={item.isArchived ? tr("Wiederherstellen", "Restore") : tr("Archivieren", "Archive")}
                >
                  {item.isArchived ? <RotateCcw size={18} /> : <Archive size={18} />}
                </button>
                <button
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--app-primary)] text-[var(--app-on-primary)] sm:h-12 sm:w-12"
                  onClick={() => setEditMode(true)}
                  disabled={deleteBusy}
                  aria-label={tr("Bearbeiten", "Edit")}
                  title={tr("Bearbeiten", "Edit")}
                >
                  <PencilLine size={18} />
                </button>
                <button
                  className="theme-status-danger inline-flex h-11 w-11 items-center justify-center rounded-xl border border-transparent sm:h-12 sm:w-12"
                  onClick={deleteItem}
                  disabled={deleteBusy}
                  aria-label={tr("Loeschen", "Delete")}
                  title={tr("Loeschen", "Delete")}
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
            <div className="inline-flex items-center gap-2"><CalendarDays size={15} /> {tr("Erstellt", "Created")}: {new Date(item.createdAt).toLocaleDateString(locale)}</div>
            <div className="inline-flex items-center gap-2"><CalendarDays size={15} /> {tr("Zuletzt bearbeitet", "Last edited")}: {new Date(item.updatedAt).toLocaleDateString(locale)}</div>
            <div className="inline-flex items-center gap-2"><User size={15} /> {tr("von", "by")} {owner}</div>
          </div>

          <div className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-4">
            <div className="mb-4 border-b border-workshop-200 pb-4">
              <h2 className="inline-flex items-center gap-2 text-[26px] font-semibold text-[var(--app-text)] sm:text-[34px]"><FolderOpen size={18} /> {tr("Details", "Details")}</h2>
              <p className="mt-2 break-words text-xl font-semibold text-[var(--app-text)] sm:text-2xl">{displayName}</p>
              <p className="theme-muted mt-1 text-sm font-mono">{item.labelCode}</p>
            </div>

            <div className="space-y-4 text-[var(--app-text)]">
              {editMode && (
              <div>
                <p className="theme-muted mb-1 text-[18px] font-medium">{tr("Name", "Name")}</p>
                <input className="input text-lg" value={form.name} onChange={(e) => setForm((v: any) => ({ ...v, name: e.target.value }))} />
              </div>
              )}

              <div>
                <p className="theme-muted mb-1 text-[18px] font-medium"># ID</p>
                {editMode ? (
                  <div className="space-y-2">
                    <p className="text-xl font-mono">{item.labelCode}</p>
                    <p className="theme-muted text-sm">{tr("Wird automatisch neu vergeben, wenn Kategorie oder Type geaendert werden.", "It will be reassigned automatically when category or type changes.")}</p>
                  </div>
                ) : (
                  <p className="text-xl font-mono">{item.labelCode}</p>
                )}
              </div>

              {editMode && (
                <div className="grid gap-4 border-t border-workshop-200 pt-4 md:grid-cols-2">
                  <div>
                    <p className="theme-muted mb-1 text-[18px] font-medium">{tr("Hersteller", "Manufacturer")}</p>
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
                  <p className="theme-muted mb-1 text-[18px] font-medium">{tr("Beschreibung", "Description")}</p>
                  {editMode ? (
                    <textarea className="input min-h-28" value={form.description} onChange={(e) => setForm((v: any) => ({ ...v, description: e.target.value }))} />
                  ) : (
                    <p className="whitespace-pre-wrap text-lg leading-8 text-[var(--app-text)]">{item.description}</p>
                  )}
                </div>
              )}

              <div className={`grid gap-4 border-t border-workshop-200 pt-4 ${editMode ? "md:grid-cols-2" : "md:grid-cols-2"}`}>
                <div>
                  <p className="theme-muted mb-1 inline-flex items-center gap-2 text-[18px] font-medium"><Layers size={15} /> {tr("Kategorie", "Category")}</p>
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
                    <p className="theme-muted mb-1 text-[18px] font-medium">{tr("Type", "Type")}</p>
                    <select className="input" value={form.typeId} onChange={(e) => setForm((v: any) => ({ ...v, typeId: e.target.value }))}>
                      <option value="">{tr("Type (Label)", "Type (Label)")}</option>
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
                      <p className="theme-muted mb-1 text-[18px] font-medium">{tr("Hersteller", "Manufacturer")}</p>
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

              {(editMode || item.storageLocation || hasPlacement) && (
                <div className={`grid gap-4 border-t border-workshop-200 pt-4 ${editMode ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-3"}`}>
                  <div>
                    <p className="theme-muted mb-1 text-[18px] font-medium">{tr("Status", "Status")}</p>
                    {editMode ? (
                      <select
                        className="input"
                        value={form.placementStatus}
                        onChange={(e) =>
                          setForm((prev: any) => ({
                            ...prev,
                            placementStatus: e.target.value,
                            ...(e.target.value !== "PLACED"
                              ? { storageLocationId: "", storageShelfId: "", storageBinId: "", binSlot: "" }
                              : {})
                          }))
                        }
                      >
                        <option value="PLACED">{tr("Eingelagert", "Placed")}</option>
                        <option value="UNPLACED">{tr("Vorhanden, aber ohne Platz", "On hand, but unplaced")}</option>
                        <option value="INCOMING">{tr("Erwartet / bestellt", "Incoming / expected")}</option>
                      </select>
                    ) : (
                      <p className="text-lg font-medium text-[var(--app-text)]">
                        {item.placementStatus === "INCOMING"
                          ? tr("Erwartet / bestellt", "Incoming / expected")
                          : item.placementStatus === "UNPLACED"
                            ? tr("Vorhanden, aber ohne Platz", "On hand, but unplaced")
                            : tr("Eingelagert", "Placed")}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="theme-muted mb-1 inline-flex items-center gap-2 text-[18px] font-medium"><MapPin size={15} /> {tr("Ort", "Location")}</p>
                    {editMode ? (
                      <select
                        className="input"
                        value={form.storageLocationId}
                        onChange={(e) =>
                          setForm((v: any) => ({
                            ...v,
                            storageLocationId: e.target.value,
                            storageShelfId: "",
                            storageBinId: "",
                            binSlot: ""
                          }))
                        }
                        disabled={!isPlaced}
                      >
                        <option value="">{tr("Kein Lagerort", "No storage location")}</option>
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

                  {(editMode || item.storageShelf) && (
                    <div>
                      <p className="theme-muted mb-1 text-[18px] font-medium">{tr("Regal / Bereich", "Shelf / area")}</p>
                      {editMode ? (
                        <select
                          className="input"
                          value={form.storageShelfId}
                          onChange={(e) =>
                            setForm((v: any) => ({
                              ...v,
                              storageShelfId: e.target.value,
                              storageBinId: "",
                              binSlot: ""
                            }))
                          }
                          disabled={!isPlaced || !form.storageLocationId}
                        >
                          <option value="">
                            {!form.storageLocationId
                              ? tr("Erst Lagerort waehlen", "Choose storage location first")
                              : availableShelves.length
                                ? tr("Regal waehlen", "Choose shelf")
                                : tr("Keine Regale fuer Lagerort", "No shelves for location")}
                          </option>
                          {availableShelves.map((shelf) => (
                            <option key={shelf.id} value={shelf.id}>
                              {[shelf.code, shelf.name].filter(Boolean).join(" - ")}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-lg text-[var(--app-text)]">{[item.storageShelf?.code, item.storageShelf?.name].filter(Boolean).join(" - ") || "-"}</p>
                      )}
                    </div>
                  )}

                  {(editMode ? usesManagedDrawer : item.storageBin) && (
                    <div>
                      <p className="theme-muted mb-1 text-[18px] font-medium">{tr("Drawer", "Drawer")}</p>
                      {editMode ? (
                        <select
                          className="input"
                          value={form.storageBinId}
                          onChange={(e) => setForm((v: any) => ({ ...v, storageBinId: e.target.value, binSlot: "" }))}
                          disabled={!isPlaced || !usesManagedDrawer}
                        >
                          <option value="">{tr("Drawer waehlen", "Choose drawer")}</option>
                          {availableBins.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {getBinLabel(entry, selectedPlacementShelf?.code || null)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-lg text-[var(--app-text)]">{item.storageBin ? getBinLabel(item.storageBin, item.storageShelf?.code || null) : "-"}</p>
                      )}
                    </div>
                  )}

                  {(editMode ? usesManagedDrawer && selectedManagedBinRequiresSlot : !!item.storageBin && (item.storageBin.slotCount || 0) > 1) && (
                    <div>
                      <p className="theme-muted mb-1 text-[18px] font-medium">{tr("Unterfach", "Slot")}</p>
                      {editMode ? (
                        <select
                          className="input"
                          value={form.binSlot}
                          onChange={(e) => setForm((v: any) => ({ ...v, binSlot: e.target.value }))}
                          disabled={!selectedManagedBin || !selectedManagedBinRequiresSlot}
                        >
                          <option value="">{selectedManagedBin ? tr("Unterfach waehlen", "Choose slot") : tr("Erst Drawer waehlen", "Choose drawer first")}</option>
                          {selectedManagedBinRequiresSlot &&
                            selectedManagedBin &&
                            Array.from({ length: selectedManagedBin.slotCount }, (_, index) => (
                              <option key={index + 1} value={String(index + 1)}>
                                {getBinLabel(selectedManagedBin, selectedPlacementShelf?.code || null)}-{index + 1}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <p className="text-lg text-[var(--app-text)]">
                          {item.storageBin
                            ? formatDrawerPosition(
                                item.storageBin.code,
                                item.binSlot || null,
                                item.storageBin.slotCount || null,
                                item.storageShelf?.code || null
                              ) || "-"
                            : "-"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {editMode && (
                <p className="theme-muted border-t border-workshop-200 pt-4 text-sm">
                  {tr("Standortwechsel werden als Umlagerung protokolliert. Fuer schnelle Lagerwechsel ist der Transfer-Block unterhalb der Details der bevorzugte Weg.", "Location changes are logged as transfers. For quick relocations, use the transfer block below the details.")}
                </p>
              )}

              {(editMode || hasTags) && (
                <div className="border-t border-workshop-200 pt-4">
                  <p className="theme-muted mb-2 inline-flex items-center gap-2 text-[18px] font-medium"><Tag size={15} /> {tr("Tags", "Tags")}</p>
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
                          placeholder={tr("Neuen Tag erstellen", "Create new tag")}
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                        />
                        <button type="button" className="btn-secondary w-full sm:w-auto" onClick={createTagInEdit} disabled={creatingTag || !newTagName.trim()}>
                          {creatingTag ? tr("Anlegen...", "Creating...") : tr("Tag anlegen", "Create tag")}
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
                  <p className="theme-muted mb-2 text-[18px] font-medium">{tr("Custom Fields", "Custom fields")}</p>
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
                <MapPin size={18} /> {tr("Umlagerung", "Transfer")}
              </h3>
              <p className="theme-muted mt-1 text-sm">{tr("Volltransfer des gesamten Items ohne Bestandsbuchung.", "Full transfer of the entire item without stock posting.")}</p>
            </div>
            <span className="rounded-full border border-workshop-200 bg-workshop-50 px-3 py-1 text-sm font-medium text-workshop-800">
              {tr("Aktuell", "Current")}: {currentStoragePlace}
            </span>
          </div>

          {transferError && <p className="theme-status-danger mb-3 rounded-lg border border-transparent px-3 py-2 text-sm">{transferError}</p>}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <label className="space-y-2 rounded-xl border border-workshop-200 p-3">
              <span className="text-sm font-medium">{tr("Ziel-Lagerort", "Target storage location")}</span>
              <select
                className="input"
                value={transferForm.storageLocationId}
                onChange={(e) =>
                  setTransferForm((prev) => ({
                    ...prev,
                    storageLocationId: e.target.value,
                    storageShelfId: "",
                    storageBinId: "",
                    binSlot: ""
                  }))
                }
              >
                <option value="">{tr("Lagerort waehlen", "Choose storage location")}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.code || "--"})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 rounded-xl border border-workshop-200 p-3">
              <span className="text-sm font-medium">{tr("Ziel-Regal / Bereich", "Target shelf / area")}</span>
              <select
                className="input"
                value={transferForm.storageShelfId}
                onChange={(e) =>
                  setTransferForm((prev) => ({
                    ...prev,
                    storageShelfId: e.target.value,
                    storageBinId: "",
                    binSlot: ""
                  }))
                }
                disabled={!transferForm.storageLocationId}
              >
                <option value="">
                  {!transferForm.storageLocationId
                    ? tr("Erst Lagerort waehlen", "Choose storage location first")
                    : availableTransferShelves.length
                      ? tr("Regal waehlen", "Choose shelf")
                      : tr("Keine Regale fuer Lagerort", "No shelves for location")}
                </option>
                {availableTransferShelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.id}>
                    {[shelf.code, shelf.name].filter(Boolean).join(" - ")}
                  </option>
                ))}
              </select>
            </label>

            {selectedTransferShelf?.mode === "DRAWER_HOST" && (
              <>
                <label className="space-y-2 rounded-xl border border-workshop-200 p-3">
                  <span className="text-sm font-medium">{tr("Ziel-Drawer", "Target drawer")}</span>
                  <select
                    className="input"
                    value={transferForm.storageBinId}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, storageBinId: e.target.value, binSlot: "" }))}
                    disabled={!transferForm.storageShelfId}
                  >
                    <option value="">
                      {!transferForm.storageShelfId
                        ? tr("Erst Regal waehlen", "Choose shelf first")
                        : tr("Drawer waehlen", "Choose drawer")}
                    </option>
                    {availableTransferBins.map((bin) => (
                      <option key={bin.id} value={bin.id}>
                        {getBinLabel(bin, selectedTransferShelf?.code || null)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 rounded-xl border border-workshop-200 p-3">
                  <span className="text-sm font-medium">{tr("Unterfach", "Slot")}</span>
                  <select
                    className="input"
                    value={transferForm.binSlot}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, binSlot: e.target.value }))}
                    disabled={!transferForm.storageBinId || !selectedTransferBinRequiresSlot}
                  >
                    <option value="">
                      {!transferForm.storageBinId
                        ? tr("Erst Drawer waehlen", "Choose drawer first")
                        : selectedTransferBinRequiresSlot
                          ? tr("Unterfach waehlen", "Choose slot")
                          : tr("Kein Unterfach erforderlich", "No slot required")}
                    </option>
                    {(selectedTransferBinRequiresSlot && selectedTransferBin
                      ? Array.from({ length: selectedTransferBin.slotCount }, (_, index) => index + 1)
                      : []
                    ).map((slot) => (
                      <option key={slot} value={String(slot)}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <label className="space-y-2 rounded-xl border border-workshop-200 p-3">
              <span className="text-sm font-medium">{tr("Notiz", "Note")}</span>
              <textarea
                className="input min-h-24"
                value={transferForm.note}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder={tr("Optional fuer Audit und Nachvollziehbarkeit", "Optional for audit trail and traceability")}
              />
            </label>

            <div className="flex flex-col justify-between gap-3 rounded-xl border border-workshop-200 p-3">
              <div className="text-sm text-workshop-700">
                <p className="font-medium text-[var(--app-text)]">{tr("Ziel", "Target")}</p>
                <p>{targetStoragePlace || tr("Noch kein Ziel gewaehlt", "No target selected yet")}</p>
              </div>
              <button type="button" className="btn w-full" onClick={submitTransfer} disabled={transferBusy}>
                {transferBusy ? tr("Speichert...", "Saving...") : tr("Umlagerung ausfuehren", "Run transfer")}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="inline-flex items-center gap-2 text-2xl font-semibold text-[var(--app-text)]"><Package2 size={18} /> {tr("Bestandsverwaltung", "Stock management")}</h3>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${item.isArchived || item.placementStatus !== "PLACED" ? "theme-status-warning" : "theme-status-success"}`}>
            {item.isArchived
              ? tr("Archiviert", "Archived")
              : item.placementStatus === "INCOMING"
                ? tr("Erwartet", "Incoming")
                : item.placementStatus === "UNPLACED"
                  ? tr("Unplatziert", "Unplaced")
                  : tr("Auf Lager", "In stock")}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="theme-surface-tonal rounded-xl p-4 text-center">
            <p className="theme-muted text-sm">{tr("Gesamtbestand", "Total stock")}</p>
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
            <p className="text-sm">{tr("Reserviert", "Reserved")}</p>
            <p className="mt-2 text-4xl font-semibold">{formatDisplayQuantity(item.unit, item.reservedQty)}</p>
          </div>

          <div className="theme-status-success rounded-xl p-4 text-center">
            <p className="text-sm">{tr("Verfuegbar", "Available")}</p>
            <p className="mt-2 text-4xl font-semibold">{formatDisplayQuantity(item.unit, item.availableStock)}</p>
          </div>

          <div className="rounded-xl border border-workshop-200 bg-[var(--app-surface-alt)] p-4 text-center">
            <p className="text-sm text-workshop-700">{tr("Erwartet", "Incoming")}</p>
            {editMode ? (
              <input
                className="input mt-3 text-center"
                type="number"
                step={getQuantityStep(item.unit)}
                value={form.incomingQty}
                onChange={(e) => setForm((prev: any) => ({ ...prev, incomingQty: e.target.value }))}
              />
            ) : (
              <p className="mt-2 text-4xl font-semibold">{formatDisplayQuantity(item.unit, item.incomingQty)}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {editMode ? (
            <label className="block w-full sm:max-w-xs">
              <p className="theme-muted mb-1 text-lg">{tr("Mindestbestand", "Minimum stock")}</p>
              <input
                className="input"
                type="number"
                step={getQuantityStep(item.unit)}
                value={form.minStock}
                onChange={(e) => setForm((prev: any) => ({ ...prev, minStock: e.target.value }))}
                placeholder={tr("leer = kein Mindestbestand", "empty = no minimum stock")}
              />
            </label>
          ) : (
            <p className="theme-muted text-lg">{tr("Mindestbestand", "Minimum stock")}: <b>{formatDisplayQuantity(item.unit, item.minStock)}</b></p>
          )}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <input
              className="input w-full sm:w-24"
              type="number"
              step={getQuantityStep(item.unit)}
              value={reservedQty}
              onChange={(e) => setReservedQty(Number(e.target.value))}
            />
            <input className="input w-full sm:min-w-[16rem] sm:flex-1" placeholder={tr("Projekt/Person", "Project/person")} value={reservedFor} onChange={(e) => setReservedFor(e.target.value)} />
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
              {tr("Reservieren", "Reserve")}
            </button>
          </div>
        </div>

        <div className="mt-4 border-t border-workshop-200 pt-3">
          <p className="theme-muted mb-2 text-lg font-medium">{tr("Aktive Reservierungen", "Active reservations")}</p>
          <ul className="space-y-2">
            {(item.reservations || []).map((r: any) => (
              <li key={r.id} className="flex flex-col gap-3 rounded-xl border border-workshop-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{r.reservedFor}</p>
                  <p className="theme-muted text-sm">{formatDisplayQuantity(item.unit, r.reservedQty)} • {new Date(r.createdAt).toLocaleDateString(locale)}</p>
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
            {item.reservations?.length === 0 && <li className="theme-muted text-sm">{tr("Keine aktiven Reservierungen", "No active reservations")}</li>}
          </ul>
        </div>

        <div className="mt-4 border-t border-workshop-200 pt-3">
          <p className="mb-2 text-sm font-semibold">{tr("Bestandsbuchung", "Stock booking")}</p>
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
            <input className="input w-full sm:min-w-[16rem] sm:flex-1" placeholder={tr("Notiz", "Note")} value={note} onChange={(e) => setNote(e.target.value)} />
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
              {tr("Buchung erfassen", "Record booking")} ({getUnitDisplayLabel(item.unit)})
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-4">
        <h3 className="mb-3 text-lg font-semibold text-[var(--app-text)]">{tr("Historie", "History")}</h3>
        <ul className="space-y-1 text-sm">
          {history.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-workshop-200 p-2">
              {new Date(entry.createdAt).toLocaleString(locale)}: {entry.text}
            </li>
          ))}
        </ul>
      </section>
      <ItemAuditSection entries={item.auditEntries || []} />
    </div>
  );
}
