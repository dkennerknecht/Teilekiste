"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Archive, CheckCheck, ChevronDown, ChevronUp, MapPin, PencilLine, Trash2, X } from "lucide-react";
import { useAppLanguage } from "@/components/app-language-provider";
import { fileHref } from "@/lib/file-href";
import { formatDisplayQuantity } from "@/lib/quantity";
import { TRASH_RETENTION_DAYS } from "@/lib/trash-policy";

type Item = {
  id: string;
  labelCode: string;
  name: string;
  stock: number;
  availableStock: number;
  minStock: number | null;
  unit: string;
  storageArea: string | null;
  bin: string | null;
  category: { name: string };
  storageLocation: { name: string };
  primaryImage: {
    path: string;
    thumbPath: string | null;
    caption: string | null;
  } | null;
};

type Option = {
  id: string;
  name: string;
};
type ShelfOption = {
  id: string;
  name: string;
  storageLocationId: string;
};

type BulkForm = {
  categoryEnabled: boolean;
  categoryId: string;
  tagsEnabled: boolean;
  tagIds: string[];
};

type BulkTransferForm = {
  storageLocationId: string;
  storageArea: string;
  bin: string;
  note: string;
};

const initialBulkForm: BulkForm = {
  categoryEnabled: false,
  categoryId: "",
  tagsEnabled: false,
  tagIds: []
};

const initialBulkTransferForm: BulkTransferForm = {
  storageLocationId: "",
  storageArea: "",
  bin: "",
  note: ""
};

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useAppLanguage();
  const tr = (de: string, en: string) => (language === "en" ? en : de);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [tags, setTags] = useState<Option[]>([]);
  const [bulkEditorOpen, setBulkEditorOpen] = useState(false);
  const [bulkTransferOpen, setBulkTransferOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkForm>(initialBulkForm);
  const [bulkTransferForm, setBulkTransferForm] = useState<BulkTransferForm>(initialBulkTransferForm);
  const [bulkTransferPreview, setBulkTransferPreview] = useState<any>(null);
  const [bulkTransferError, setBulkTransferError] = useState("");
  const [bulkTransferBusy, setBulkTransferBusy] = useState(false);
  const [bulkActionError, setBulkActionError] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const queryString = searchParams.toString();
  const categoryFilter = searchParams.get("categoryId") || "";
  const locationFilter = searchParams.get("storageLocationId") || "";
  const tagFilter = searchParams.get("tagId") || "";
  const lowStockFilter = searchParams.get("lowStock") === "1";
  const hasImagesFilter = searchParams.get("hasImages") === "1";

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/items${queryString ? `?${queryString}` : ""}`);
    const data = await res.json();
    setItems(Array.isArray(data) ? data : data.items || []);
    setLoading(false);
  }, [queryString]);

  async function quickAdjust(itemId: string, delta: number) {
    await fetch(`/api/items/${itemId}/movements`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        delta,
        reason: delta < 0 ? "CONSUMPTION" : "PURCHASE",
        note: "Quick Button"
      })
    });
    await load();
  }

  function openItem(itemId: string) {
    router.push(`/items/${itemId}`);
  }

  function handleRowKeyDown(event: React.KeyboardEvent<HTMLElement>, itemId: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openItem(itemId);
  }

  function stopRowNavigation(event: React.SyntheticEvent) {
    event.stopPropagation();
  }

  function updateListQuery(update: (params: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(searchParams.toString());
    update(nextParams);
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/?${nextQuery}` : "/", { scroll: false });
  }

  function clearFilters() {
    updateListQuery((params) => {
      params.delete("categoryId");
      params.delete("storageLocationId");
      params.delete("tagId");
      params.delete("lowStock");
      params.delete("hasImages");
    });
  }

  function toggleSelected(itemId: string, checked: boolean) {
    setSelected((prev) => {
      if (checked) {
        return prev.includes(itemId) ? prev : [...prev, itemId];
      }
      return prev.filter((id) => id !== itemId);
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelected(checked ? items.map((item) => item.id) : []);
  }

  function resetBulkEditor() {
    setBulkEditorOpen(false);
    setBulkForm(initialBulkForm);
    setBulkError("");
    setBulkSaving(false);
  }

  function resetBulkTransfer() {
    setBulkTransferOpen(false);
    setBulkTransferForm(initialBulkTransferForm);
    setBulkTransferPreview(null);
    setBulkTransferError("");
    setBulkTransferBusy(false);
  }

  function resetBulkDelete() {
    setBulkDeleteOpen(false);
    setBulkDeleteError("");
    setBulkDeleting(false);
  }

  function toggleBulkTag(tagId: string) {
    setBulkForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId) ? prev.tagIds.filter((id) => id !== tagId) : [...prev.tagIds, tagId]
    }));
  }

  async function applyBulkEdit() {
    if (!selected.length) {
      setBulkError(tr("Bitte zuerst mindestens ein Item auswaehlen.", "Please select at least one item first."));
      return;
    }

    if (
      !bulkForm.categoryEnabled &&
      !bulkForm.tagsEnabled
    ) {
      setBulkError(tr("Bitte mindestens ein Feld fuer die Sammelbearbeitung aktivieren.", "Please enable at least one field for bulk editing."));
      return;
    }

    if (bulkForm.categoryEnabled && !bulkForm.categoryId) {
      setBulkError(tr("Bitte eine Kategorie auswaehlen.", "Please choose a category."));
      return;
    }

    setBulkSaving(true);
    setBulkError("");

    const payload: Record<string, unknown> = { itemIds: selected };

    if (bulkForm.categoryEnabled) {
      payload.categoryId = bulkForm.categoryId;
    }
    if (bulkForm.tagsEnabled) {
      payload.setTagIds = bulkForm.tagIds;
    }

    const res = await fetch("/api/items/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setBulkError(data?.error || tr("Die Sammelbearbeitung konnte nicht gespeichert werden.", "Bulk edit could not be saved."));
      setBulkSaving(false);
      return;
    }

    setSelected([]);
    resetBulkEditor();
    await load();
  }

  async function previewBulkTransfer() {
    if (!selected.length) {
      setBulkTransferError(tr("Bitte zuerst mindestens ein Item auswaehlen.", "Please select at least one item first."));
      return;
    }
    if (!bulkTransferForm.storageLocationId) {
      setBulkTransferError(tr("Bitte einen Ziel-Lagerort auswaehlen.", "Please choose a target storage location."));
      return;
    }

    setBulkTransferBusy(true);
    setBulkTransferError("");

    const res = await fetch("/api/items/bulk-transfer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        itemIds: selected,
        storageLocationId: bulkTransferForm.storageLocationId,
        storageArea: bulkTransferForm.storageArea.trim() || null,
        bin: bulkTransferForm.bin.trim() || null,
        note: bulkTransferForm.note.trim() || null,
        dryRun: true
      })
    });
    const data = await res.json().catch(() => null);
    setBulkTransferBusy(false);

    if (!res.ok && !data) {
      setBulkTransferError(tr("Transfer-Vorschau konnte nicht geladen werden.", "Transfer preview could not be loaded."));
      return;
    }

    setBulkTransferPreview(data);
    if (!res.ok) {
      setBulkTransferError(data?.targetError || data?.error || tr("Transfer-Vorschau hat Blocker.", "Transfer preview has blockers."));
    }
  }

  async function applyBulkTransfer() {
    if (!selected.length) {
      setBulkTransferError(tr("Bitte zuerst mindestens ein Item auswaehlen.", "Please select at least one item first."));
      return;
    }
    if (!bulkTransferForm.storageLocationId) {
      setBulkTransferError(tr("Bitte einen Ziel-Lagerort auswaehlen.", "Please choose a target storage location."));
      return;
    }

    setBulkTransferBusy(true);
    setBulkTransferError("");

    const res = await fetch("/api/items/bulk-transfer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        itemIds: selected,
        storageLocationId: bulkTransferForm.storageLocationId,
        storageArea: bulkTransferForm.storageArea.trim() || null,
        bin: bulkTransferForm.bin.trim() || null,
        note: bulkTransferForm.note.trim() || null
      })
    });
    const data = await res.json().catch(() => null);
    setBulkTransferBusy(false);

    if (!res.ok) {
      setBulkTransferPreview(data);
      setBulkTransferError(data?.targetError || data?.error || tr("Die Sammelumlagerung konnte nicht gespeichert werden.", "Bulk transfer could not be saved."));
      return;
    }

    setSelected([]);
    resetBulkTransfer();
    await load();
  }

  async function applyBulkArchive() {
    if (!selected.length) {
      setBulkActionError(tr("Bitte zuerst mindestens ein Item auswaehlen.", "Please select at least one item first."));
      return;
    }

    setBulkArchiving(true);
    setBulkActionError("");

    const res = await fetch("/api/items/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        itemIds: selected,
        archiveItems: true
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setBulkActionError(data?.error || tr("Die markierten Items konnten nicht archiviert werden.", "The selected items could not be archived."));
      setBulkArchiving(false);
      return;
    }

    setSelected([]);
    setBulkArchiving(false);
    await load();
  }

  async function applyBulkDelete() {
    if (!selected.length) {
      setBulkDeleteError(tr("Bitte zuerst mindestens ein Item auswaehlen.", "Please select at least one item first."));
      return;
    }

    setBulkDeleting(true);
    setBulkDeleteError("");

    const res = await fetch("/api/items/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        itemIds: selected,
        deleteItems: true
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setBulkDeleteError(data?.error || tr("Die markierten Items konnten nicht geloescht werden.", "The selected items could not be deleted."));
      setBulkDeleting(false);
      return;
    }

    setSelected([]);
    resetBulkDelete();
    resetBulkEditor();
    await load();
  }

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((m) => {
        setCategories(m.categories || []);
        setLocations(m.locations || []);
        setShelves(m.shelves || []);
        setTags(m.tags || []);
      });
  }, []);

  useEffect(() => {
    const visibleIds = new Set(items.map((item) => item.id));
    setSelected((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [items]);

  useEffect(() => {
    if (!selected.length && bulkEditorOpen) {
      resetBulkEditor();
    }
    if (!selected.length && bulkTransferOpen) {
      resetBulkTransfer();
    }
    if (!selected.length && bulkDeleteOpen) {
      resetBulkDelete();
    }
    if (!selected.length) {
      setBulkActionError("");
      setBulkArchiving(false);
    }
  }, [bulkDeleteOpen, bulkEditorOpen, bulkTransferOpen, selected.length]);

  const selectedSet = new Set(selected);
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedSet.has(item.id));
  const availableBulkTransferShelves = shelves.filter((shelf) => shelf.storageLocationId === bulkTransferForm.storageLocationId);
  const hasActiveFilters = Boolean(categoryFilter || locationFilter || tagFilter || lowStockFilter || hasImagesFilter);
  const activeFilterCount = [Boolean(categoryFilter), Boolean(locationFilter), Boolean(tagFilter), lowStockFilter, hasImagesFilter].filter(Boolean).length;

  useEffect(() => {
    if (hasActiveFilters) {
      setMobileFiltersOpen(true);
    }
  }, [hasActiveFilters]);

  return (
    <div className="space-y-4">
      {selected.length > 0 && (
        <div className="pointer-events-none fixed inset-x-3 bottom-4 z-40 flex justify-center">
          <div className="pointer-events-auto rounded-2xl border border-workshop-200 bg-[var(--app-surface)] px-2 py-2 shadow-xl">
            <div className="flex items-center gap-1.5">
              <span className="rounded-xl bg-[var(--app-surface-alt)] px-3 py-2 text-sm font-medium">
                {selected.length}
              </span>
              {!allVisibleSelected && items.length > 1 && (
                <button
                  className="btn-secondary inline-flex h-10 w-10 items-center justify-center px-0 py-0"
                  onClick={() => toggleAllVisible(true)}
                  aria-label={tr("Alle sichtbaren auswaehlen", "Select all visible")}
                  title={tr("Alle sichtbaren auswaehlen", "Select all visible")}
                >
                  <CheckCheck size={18} />
                </button>
              )}
              <button
                className="btn inline-flex h-10 w-10 items-center justify-center px-0 py-0"
                onClick={() => setBulkEditorOpen(true)}
                aria-label={tr("Sammelbearbeitung", "Bulk edit")}
                title={tr("Sammelbearbeitung", "Bulk edit")}
              >
                <PencilLine size={18} />
              </button>
              <button
                className="btn-secondary inline-flex h-10 w-10 items-center justify-center px-0 py-0"
                onClick={() => setBulkTransferOpen(true)}
                aria-label={tr("Sammelumlagerung", "Bulk transfer")}
                title={tr("Sammelumlagerung", "Bulk transfer")}
              >
                <MapPin size={18} />
              </button>
              <button
                className="btn-secondary inline-flex h-10 w-10 items-center justify-center px-0 py-0"
                onClick={applyBulkArchive}
                disabled={bulkArchiving}
                aria-label={tr("Archivieren", "Archive")}
                title={tr("Archivieren", "Archive")}
              >
                <Archive size={18} />
              </button>
              <button
                className="theme-status-danger inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent px-0 py-0"
                onClick={() => setBulkDeleteOpen(true)}
                aria-label={tr("Loeschen", "Delete")}
                title={tr("Loeschen", "Delete")}
              >
                <Trash2 size={18} />
              </button>
              <button
                className="btn-secondary inline-flex h-10 w-10 items-center justify-center px-0 py-0"
                onClick={() => setSelected([])}
                aria-label={tr("Auswahl aufheben", "Clear selection")}
                title={tr("Auswahl aufheben", "Clear selection")}
              >
                <X size={18} />
              </button>
            </div>
            {bulkActionError && (
              <p className="mt-2 max-w-[16rem] text-sm text-red-700">{bulkActionError}</p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] px-3 py-2 shadow-sm">
        <div className="md:hidden">
          <button
            type="button"
            className="btn-secondary flex h-10 w-full items-center justify-between px-3 py-1 text-sm"
            onClick={() => setMobileFiltersOpen((current) => !current)}
            aria-expanded={mobileFiltersOpen}
            aria-label={tr("Filter umschalten", "Toggle filters")}
          >
            <span>{tr("Filter", "Filters")}{activeFilterCount ? ` (${activeFilterCount})` : ""}</span>
            {mobileFiltersOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        <div
          className={`${mobileFiltersOpen ? "grid" : "hidden"} mt-2 max-w-full gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto] md:mt-0 md:grid`}
        >
          <select
            className="input h-10 min-h-0 min-w-0"
            value={categoryFilter}
            onChange={(e) =>
              updateListQuery((params) => {
                if (e.target.value) params.set("categoryId", e.target.value);
                else params.delete("categoryId");
              })
            }
            aria-label={tr("Nach Kategorie filtern", "Filter by category")}
          >
            <option value="">{tr("Alle Kategorien", "All categories")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            className="input h-10 min-h-0 min-w-0"
            value={locationFilter}
            onChange={(e) =>
              updateListQuery((params) => {
                if (e.target.value) params.set("storageLocationId", e.target.value);
                else params.delete("storageLocationId");
              })
            }
            aria-label={tr("Nach Lagerort filtern", "Filter by storage location")}
          >
            <option value="">{tr("Alle Orte", "All locations")}</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <select
            className="input h-10 min-h-0 min-w-0"
            value={tagFilter}
            onChange={(e) =>
              updateListQuery((params) => {
                if (e.target.value) params.set("tagId", e.target.value);
                else params.delete("tagId");
              })
            }
            aria-label={tr("Nach Tag filtern", "Filter by tag")}
          >
            <option value="">{tr("Alle Tags", "All tags")}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`${lowStockFilter ? "btn" : "btn-secondary"} h-10 w-full px-3 py-1 text-sm xl:w-auto xl:whitespace-nowrap`}
            onClick={() =>
              updateListQuery((params) => {
                if (lowStockFilter) params.delete("lowStock");
                else params.set("lowStock", "1");
              })
            }
          >
            {tr("Unter Minimum", "Below minimum")}
          </button>

          <button
            type="button"
            className={`${hasImagesFilter ? "btn" : "btn-secondary"} h-10 w-full px-3 py-1 text-sm xl:w-auto xl:whitespace-nowrap`}
            onClick={() =>
              updateListQuery((params) => {
                if (hasImagesFilter) params.delete("hasImages");
                else params.set("hasImages", "1");
              })
            }
          >
            {tr("Mit Bild", "With image")}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              className="btn-secondary h-10 w-full px-3 py-1 text-sm xl:w-auto xl:whitespace-nowrap"
              onClick={clearFilters}
            >
              {tr("Filter zuruecksetzen", "Reset filters")}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="card">
            <p>{tr("Lade...", "Loading...")}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="card">
            <p className="text-sm text-workshop-700">{tr("Keine Items gefunden.", "No items found.")}</p>
          </div>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className="cursor-pointer rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-2.5 shadow-sm transition-colors hover:bg-[var(--app-surface-alt)]"
              onClick={() => openItem(item.id)}
              onKeyDown={(event) => handleRowKeyDown(event, item.id)}
              role="link"
              tabIndex={0}
            >
              <div className="flex items-center gap-2">
                <input
                  className="shrink-0"
                  type="checkbox"
                  checked={selectedSet.has(item.id)}
                  onClick={stopRowNavigation}
                  onChange={(e) => toggleSelected(item.id, e.target.checked)}
                />
                {item.primaryImage ? (
                  <Image
                    src={fileHref(item.primaryImage.thumbPath || item.primaryImage.path)}
                    alt={item.primaryImage.caption || item.name}
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 shrink-0 rounded border border-workshop-200 object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded border border-dashed border-workshop-200" />
                )}
                <div className="min-w-0 flex-1 leading-tight">
                  <Link
                    href={`/items/${item.id}`}
                    className="block truncate font-mono text-xs text-workshop-700 underline"
                    onClick={stopRowNavigation}
                  >
                    {item.labelCode}
                  </Link>
                  <p className="mt-0.5 truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-xs text-workshop-700">
                    {item.category.name} · {item.storageLocation.name}
                  </p>
                  <p className={`text-xs ${item.minStock !== null && item.availableStock <= item.minStock ? "text-red-700" : "text-workshop-700"}`}>
                    {tr("Verfuegbar", "Available")} {formatDisplayQuantity(item.unit, item.availableStock)}
                  </p>
                </div>
                <div
                  className="flex shrink-0 items-center gap-1 rounded-xl px-1 py-1"
                  onClick={stopRowNavigation}
                  onKeyDown={stopRowNavigation}
                >
                  {[-1, 1].map((delta) => (
                    <button
                      key={delta}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-workshop-300 bg-[var(--app-surface)] text-lg font-medium text-workshop-800"
                      onClick={() => quickAdjust(item.id, delta)}
                    >
                      {delta > 0 ? "+" : "-"}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="hidden md:block">
        {loading ? (
          <div className="card">
            <p>{tr("Lade...", "Loading...")}</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead>
                <tr className="border-b border-workshop-200 text-left">
                  <th className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                      aria-label={tr("Alle sichtbaren Items auswaehlen", "Select all visible items")}
                    />
                  </th>
                  <th className="px-2 py-2">{tr("Bild", "Image")}</th>
                  <th className="px-2 py-2">{tr("Code", "Code")}</th>
                  <th className="px-2 py-2">{tr("Name", "Name")}</th>
                  <th className="px-2 py-2">{tr("Kategorie", "Category")}</th>
                  <th className="px-2 py-2">{tr("Ort", "Location")}</th>
                  <th className="px-2 py-2">{tr("Verfuegbar", "Available")}</th>
                  <th className="px-2 py-2">+/-</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-workshop-100 transition-colors hover:bg-[var(--app-surface-alt)]"
                    onClick={() => openItem(item.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, item.id)}
                    role="link"
                    tabIndex={0}
                  >
                    <td className="px-2 py-2" onClick={stopRowNavigation}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(item.id)}
                        onClick={stopRowNavigation}
                        onChange={(e) => toggleSelected(item.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      {item.primaryImage ? (
                        <Image
                          src={fileHref(item.primaryImage.thumbPath || item.primaryImage.path)}
                          alt={item.primaryImage.caption || item.name}
                          width={48}
                          height={48}
                          unoptimized
                          className="h-12 w-12 rounded border border-workshop-200 object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded border border-dashed border-workshop-200" />
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono">
                      <Link href={`/items/${item.id}`} className="text-workshop-700 underline" onClick={stopRowNavigation}>
                        {item.labelCode}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{item.name}</td>
                    <td className="px-2 py-2">{item.category.name}</td>
                    <td className="px-2 py-2">{item.storageLocation.name}</td>
                    <td className={`px-2 py-2 ${item.minStock !== null && item.availableStock <= item.minStock ? "text-red-700" : ""}`}>
                      {formatDisplayQuantity(item.unit, item.availableStock)}
                    </td>
                    <td className="px-2 py-2" onClick={stopRowNavigation}>
                      <div className="flex w-fit gap-1 rounded-xl px-1 py-1">
                        {[-1, 1].map((delta) => (
                          <button
                            key={delta}
                            className="btn-secondary px-3 py-1 text-lg"
                            onClick={() => quickAdjust(item.id, delta)}
                          >
                            {delta > 0 ? "+" : "-"}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {bulkEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-3 sm:items-center sm:justify-center sm:p-4" onClick={resetBulkEditor}>
          <div
            className="max-h-[90vh] w-full overflow-hidden rounded-2xl border border-workshop-200 bg-[var(--app-surface)] shadow-xl sm:max-w-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-workshop-200 px-4 py-3">
              <div>
                <p className="text-base font-semibold">{tr("Sammelbearbeitung", "Bulk edit")}</p>
                <p className="text-sm text-workshop-700">{language === "en" ? `${selected.length} items will be updated together.` : `${selected.length} Items werden gemeinsam aktualisiert.`}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-workshop-200 text-lg"
                onClick={resetBulkEditor}
                aria-label={tr("Sammelbearbeitung schliessen", "Close bulk edit")}
              >
                ×
              </button>
            </div>

            <div className="max-h-[calc(90vh-8.5rem)] space-y-4 overflow-y-auto px-4 py-4">
              {bulkError && <p className="theme-status-danger rounded-lg border border-transparent px-3 py-2 text-sm">{bulkError}</p>}
              <p className="text-xs text-workshop-700">
                {tr("Kategorie und Tags koennen hier gemeinsam gesetzt werden. Lagerwechsel laufen separat ueber die Sammelumlagerung.", "Categories and tags can be set together here. Location changes are handled separately through bulk transfer.")}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-workshop-200 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={bulkForm.categoryEnabled}
                      onChange={(e) => setBulkForm((prev) => ({ ...prev, categoryEnabled: e.target.checked }))}
                    />
                    {tr("Kategorie setzen", "Set category")}
                  </label>
                  <select
                    className="input h-10 min-h-0"
                    value={bulkForm.categoryId}
                    onChange={(e) =>
                      setBulkForm((prev) => ({
                        ...prev,
                        categoryId: e.target.value,
                        categoryEnabled: prev.categoryEnabled || Boolean(e.target.value)
                      }))
                    }
                  >
                    <option value="">{tr("Kategorie waehlen", "Choose category")}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              <div className="space-y-3 rounded-xl border border-workshop-200 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={bulkForm.tagsEnabled}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, tagsEnabled: e.target.checked }))}
                  />
                  {tr("Tags ersetzen", "Replace tags")}
                </label>
                <p className="text-xs text-workshop-700">{tr("Wenn aktiv, wird die Tag-Auswahl fuer alle markierten Items exakt auf diesen Stand gesetzt.", "When enabled, the tag selection will be set exactly to this state for all selected items.")}</p>
                {tags.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-workshop-200 px-3 py-2 text-sm text-workshop-700">{tr("Keine Tags vorhanden.", "No tags available.")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className={`rounded-full border px-3 py-1 text-sm ${
                          bulkForm.tagIds.includes(tag.id)
                            ? "border-[var(--app-primary)] bg-[var(--app-primary)] text-[var(--app-on-primary)]"
                            : "border-workshop-200 bg-[var(--app-surface)] text-workshop-800"
                        }`}
                        onClick={() => {
                          setBulkForm((prev) => ({
                            ...prev,
                            tagsEnabled: true
                          }));
                          toggleBulkTag(tag.id);
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-workshop-200 px-4 py-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary w-full sm:w-auto" onClick={resetBulkEditor}>
                {tr("Abbrechen", "Cancel")}
              </button>
              <button type="button" className="btn w-full sm:w-auto" onClick={applyBulkEdit} disabled={bulkSaving}>
                {bulkSaving ? tr("Speichert...", "Saving...") : tr("Aenderungen uebernehmen", "Apply changes")}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkTransferOpen && (
        <div className="fixed inset-0 z-[55] flex items-end bg-black/45 p-3 sm:items-center sm:justify-center sm:p-4" onClick={resetBulkTransfer}>
          <div
            className="max-h-[90vh] w-full overflow-hidden rounded-2xl border border-workshop-200 bg-[var(--app-surface)] shadow-xl sm:max-w-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-workshop-200 px-4 py-3">
              <div>
                <p className="text-base font-semibold">{tr("Sammelumlagerung", "Bulk transfer")}</p>
                <p className="text-sm text-workshop-700">{language === "en" ? `${selected.length} items will be moved to the same target location.` : `${selected.length} Items werden an denselben Zielplatz verschoben.`}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-workshop-200 text-lg"
                onClick={resetBulkTransfer}
                aria-label={tr("Sammelumlagerung schliessen", "Close bulk transfer")}
              >
                ×
              </button>
            </div>

            <div className="max-h-[calc(90vh-8.5rem)] space-y-4 overflow-y-auto px-4 py-4">
              {bulkTransferError && <p className="theme-status-danger rounded-lg border border-transparent px-3 py-2 text-sm">{bulkTransferError}</p>}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-workshop-200 p-3 sm:col-span-2">
                  <label className="text-sm font-medium">{tr("Ziel-Lagerort", "Target storage location")}</label>
                  <select
                    className="input h-10 min-h-0"
                    value={bulkTransferForm.storageLocationId}
                    onChange={(e) =>
                      setBulkTransferForm((prev) => ({
                        ...prev,
                        storageLocationId: e.target.value,
                        storageArea: ""
                      }))
                    }
                  >
                    <option value="">{tr("Lagerort waehlen", "Choose storage location")}</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 rounded-xl border border-workshop-200 p-3">
                  <label className="text-sm font-medium">{tr("Ziel-Regal / Bereich", "Target shelf / area")}</label>
                  <select
                    className="input h-10 min-h-0"
                    value={bulkTransferForm.storageArea}
                    onChange={(e) => setBulkTransferForm((prev) => ({ ...prev, storageArea: e.target.value }))}
                    disabled={!bulkTransferForm.storageLocationId}
                  >
                    <option value="">
                      {!bulkTransferForm.storageLocationId
                        ? tr("Erst Lagerort waehlen", "Choose storage location first")
                        : availableBulkTransferShelves.length
                        ? tr("Kein Regal", "No shelf")
                        : tr("Keine Regale fuer Lagerort", "No shelves for location")}
                    </option>
                    {availableBulkTransferShelves.map((shelf) => (
                      <option key={shelf.id} value={shelf.name}>
                        {shelf.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 rounded-xl border border-workshop-200 p-3">
                  <label className="text-sm font-medium">{tr("Ziel-Fach / Bin", "Target bin")}</label>
                  <input
                    className="input h-10 min-h-0"
                    value={bulkTransferForm.bin}
                    onChange={(e) => setBulkTransferForm((prev) => ({ ...prev, bin: e.target.value }))}
                    placeholder={tr("Leer = Fach entfernen", "Empty = clear bin")}
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-workshop-200 p-3">
                <label className="text-sm font-medium">{tr("Notiz", "Note")}</label>
                <textarea
                  className="input min-h-24"
                  value={bulkTransferForm.note}
                  onChange={(e) => setBulkTransferForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder={tr("Optional fuer Audit und Nachvollziehbarkeit", "Optional for audit trail and traceability")}
                />
              </div>

              {bulkTransferPreview && (
                <div className="space-y-3 rounded-xl border border-workshop-200 p-3">
                  <div className="text-sm text-workshop-700">
                    <p>{tr("Items", "Items")}: {bulkTransferPreview.count} | {tr("uebertragbar", "transferable")}: {bulkTransferPreview.transferableCount}</p>
                    <p>
                      {tr("Ziel", "Target")}: {bulkTransferPreview.target.storageLocationName || "-"}
                      {bulkTransferPreview.target.storageArea ? ` / ${bulkTransferPreview.target.storageArea}` : ""}
                      {bulkTransferPreview.target.bin ? ` / ${bulkTransferPreview.target.bin}` : ""}
                    </p>
                    {bulkTransferPreview.targetError && <p className="text-red-700">{bulkTransferPreview.targetError}</p>}
                  </div>

                  {!!bulkTransferPreview.sourceGroups?.length && (
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">{tr("Quellplaetze", "Source locations")}</p>
                      {bulkTransferPreview.sourceGroups.map((group: any) => (
                        <p key={`${group.storageLocationId}:${group.storageArea || ""}:${group.bin || ""}`}>
                          {group.count}x {group.storageLocationName}
                          {group.storageArea ? ` / ${group.storageArea}` : ""}
                          {group.bin ? ` / ${group.bin}` : ""}
                        </p>
                      ))}
                    </div>
                  )}

                  {!!bulkTransferPreview.blockedItems?.length && (
                    <div className="space-y-1 text-sm text-red-700">
                      <p className="font-medium">{tr("Blockierte Items", "Blocked items")}</p>
                      {bulkTransferPreview.blockedItems.map((entry: any) => (
                        <p key={`${entry.itemId}:${entry.reason}`}>
                          {(entry.labelCode || entry.itemId) + (entry.name ? ` (${entry.name})` : "")}: {entry.reason}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-workshop-200 px-4 py-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary w-full sm:w-auto" onClick={resetBulkTransfer}>
                {tr("Abbrechen", "Cancel")}
              </button>
              <button type="button" className="btn-secondary w-full sm:w-auto" onClick={previewBulkTransfer} disabled={bulkTransferBusy}>
                {bulkTransferBusy ? tr("Laedt...", "Loading...") : tr("Vorschau", "Preview")}
              </button>
              <button type="button" className="btn w-full sm:w-auto" onClick={applyBulkTransfer} disabled={bulkTransferBusy}>
                {bulkTransferBusy ? tr("Speichert...", "Saving...") : tr("Umlagerung ausfuehren", "Run transfer")}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/45 p-3 sm:items-center sm:justify-center sm:p-4" onClick={resetBulkDelete}>
          <div
            className="w-full rounded-2xl border border-workshop-200 bg-[var(--app-surface)] shadow-xl sm:max-w-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-3 px-4 py-4">
              <div>
                <p className="text-base font-semibold">{tr("Items loeschen", "Delete items")}</p>
                <p className="mt-1 text-sm text-workshop-700">
                  {language === "en" ? `${selected.length} selected items will be moved to trash and can be restored there for ${TRASH_RETENTION_DAYS} days.` : `${selected.length} markierte Items werden in den Papierkorb verschoben und bleiben dort ${TRASH_RETENTION_DAYS} Tage lang wiederherstellbar.`}
                </p>
              </div>
              {bulkDeleteError && <p className="theme-status-danger rounded-lg border border-transparent px-3 py-2 text-sm">{bulkDeleteError}</p>}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-workshop-200 px-4 py-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary w-full sm:w-auto" onClick={resetBulkDelete}>
                {tr("Abbrechen", "Cancel")}
              </button>
              <button
                type="button"
                className="theme-status-danger w-full rounded-lg border border-transparent px-4 py-2 text-sm font-medium sm:w-auto"
                onClick={applyBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? tr("Loescht...", "Deleting...") : tr("In Papierkorb verschieben", "Move to trash")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
