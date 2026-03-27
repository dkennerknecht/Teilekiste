"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fileHref } from "@/lib/file-href";
import { TRASH_RETENTION_DAYS } from "@/lib/trash-policy";

type Item = {
  id: string;
  labelCode: string;
  name: string;
  stock: number;
  availableStock: number;
  minStock: number | null;
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
  storageLocationEnabled: boolean;
  storageLocationId: string;
  storageAreaEnabled: boolean;
  storageArea: string;
  binEnabled: boolean;
  bin: string;
  tagsEnabled: boolean;
  tagIds: string[];
};

const initialBulkForm: BulkForm = {
  categoryEnabled: false,
  categoryId: "",
  storageLocationEnabled: false,
  storageLocationId: "",
  storageAreaEnabled: false,
  storageArea: "",
  binEnabled: false,
  bin: "",
  tagsEnabled: false,
  tagIds: []
};

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [tags, setTags] = useState<Option[]>([]);
  const [bulkEditorOpen, setBulkEditorOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkForm>(initialBulkForm);
  const [bulkActionError, setBulkActionError] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchQuery = searchParams.get("q")?.trim() || "";

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/items?q=${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    setItems(Array.isArray(data) ? data : data.items || []);
    setLoading(false);
  }, [searchQuery]);

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
      setBulkError("Bitte zuerst mindestens ein Item auswaehlen.");
      return;
    }

    if (
      !bulkForm.categoryEnabled &&
      !bulkForm.storageLocationEnabled &&
      !bulkForm.storageAreaEnabled &&
      !bulkForm.binEnabled &&
      !bulkForm.tagsEnabled
    ) {
      setBulkError("Bitte mindestens ein Feld fuer die Sammelbearbeitung aktivieren.");
      return;
    }

    if (bulkForm.categoryEnabled && !bulkForm.categoryId) {
      setBulkError("Bitte eine Kategorie auswaehlen.");
      return;
    }

    if (bulkForm.storageLocationEnabled && !bulkForm.storageLocationId) {
      setBulkError("Bitte einen Lagerort auswaehlen.");
      return;
    }

    if (bulkForm.storageAreaEnabled && !bulkForm.storageLocationId) {
      setBulkError("Bitte zuerst einen Lagerort waehlen, damit ein Regal gesetzt werden kann.");
      return;
    }

    setBulkSaving(true);
    setBulkError("");

    const payload: Record<string, unknown> = { itemIds: selected };

    if (bulkForm.categoryEnabled) {
      payload.categoryId = bulkForm.categoryId;
    }
    if (bulkForm.storageLocationEnabled) {
      payload.storageLocationId = bulkForm.storageLocationId;
    }
    if (bulkForm.storageAreaEnabled) {
      payload.storageArea = bulkForm.storageArea.trim() || null;
    }
    if (bulkForm.binEnabled) {
      payload.bin = bulkForm.bin.trim() || null;
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
      setBulkError(data?.error || "Die Sammelbearbeitung konnte nicht gespeichert werden.");
      setBulkSaving(false);
      return;
    }

    setSelected([]);
    resetBulkEditor();
    await load();
  }

  async function applyBulkArchive() {
    if (!selected.length) {
      setBulkActionError("Bitte zuerst mindestens ein Item auswaehlen.");
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
      setBulkActionError(data?.error || "Die markierten Items konnten nicht archiviert werden.");
      setBulkArchiving(false);
      return;
    }

    setSelected([]);
    setBulkArchiving(false);
    await load();
  }

  async function applyBulkDelete() {
    if (!selected.length) {
      setBulkDeleteError("Bitte zuerst mindestens ein Item auswaehlen.");
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
      setBulkDeleteError(data?.error || "Die markierten Items konnten nicht geloescht werden.");
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
    if (!selected.length && bulkDeleteOpen) {
      resetBulkDelete();
    }
    if (!selected.length) {
      setBulkActionError("");
      setBulkArchiving(false);
    }
  }, [bulkDeleteOpen, bulkEditorOpen, selected.length]);

  const selectedSet = new Set(selected);
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedSet.has(item.id));
  const availableBulkShelves = shelves.filter((shelf) => shelf.storageLocationId === bulkForm.storageLocationId);

  return (
    <div className="space-y-4">
      {selected.length > 0 && (
        <div className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="whitespace-nowrap text-sm font-medium">{selected.length} ausgewaehlt</span>
            {!allVisibleSelected && items.length > 1 && (
              <button className="btn-secondary h-8 shrink-0 px-2.5 py-1 text-sm" onClick={() => toggleAllVisible(true)}>
                Alle sichtbar
              </button>
            )}
            <button className="btn h-8 shrink-0 px-2.5 py-1 text-sm" onClick={() => setBulkEditorOpen(true)}>
              Bearbeiten
            </button>
            <button className="btn-secondary h-8 shrink-0 px-2.5 py-1 text-sm" onClick={applyBulkArchive} disabled={bulkArchiving}>
              {bulkArchiving ? "Archiviert..." : "Archivieren"}
            </button>
            <button
              className="theme-status-danger h-8 shrink-0 rounded-lg border border-transparent px-2.5 py-1 text-sm font-medium"
              onClick={() => setBulkDeleteOpen(true)}
            >
              Loeschen
            </button>
            <button className="btn-secondary h-8 shrink-0 px-2.5 py-1 text-sm" onClick={() => setSelected([])}>
              Abwaehlen
            </button>
          </div>
          {bulkActionError && <p className="mt-2 text-sm text-red-700">{bulkActionError}</p>}
        </div>
      )}

      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="card">
            <p>Lade...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="card">
            <p className="text-sm text-workshop-700">Keine Items gefunden.</p>
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
                    Verfuegbar {item.availableStock}
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
            <p>Lade...</p>
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
                      aria-label="Alle sichtbaren Items auswaehlen"
                    />
                  </th>
                  <th className="px-2 py-2">Bild</th>
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Kategorie</th>
                  <th className="px-2 py-2">Ort</th>
                  <th className="px-2 py-2">Verfuegbar</th>
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
                      {item.availableStock}
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
                <p className="text-base font-semibold">Sammelbearbeitung</p>
                <p className="text-sm text-workshop-700">{selected.length} Items werden gemeinsam aktualisiert.</p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-workshop-200 text-lg"
                onClick={resetBulkEditor}
                aria-label="Sammelbearbeitung schliessen"
              >
                ×
              </button>
            </div>

            <div className="max-h-[calc(90vh-8.5rem)] space-y-4 overflow-y-auto px-4 py-4">
              {bulkError && <p className="theme-status-danger rounded-lg border border-transparent px-3 py-2 text-sm">{bulkError}</p>}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-workshop-200 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={bulkForm.categoryEnabled}
                      onChange={(e) => setBulkForm((prev) => ({ ...prev, categoryEnabled: e.target.checked }))}
                    />
                    Kategorie setzen
                  </label>
                  <select
                    className="input h-10 min-h-0"
                    value={bulkForm.categoryId}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                    disabled={!bulkForm.categoryEnabled}
                  >
                    <option value="">Kategorie waehlen</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 rounded-xl border border-workshop-200 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={bulkForm.storageLocationEnabled}
                      onChange={(e) => setBulkForm((prev) => ({ ...prev, storageLocationEnabled: e.target.checked }))}
                    />
                    Lagerort setzen
                  </label>
                  <select
                    className="input h-10 min-h-0"
                    value={bulkForm.storageLocationId}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, storageLocationId: e.target.value, storageArea: "" }))}
                    disabled={!bulkForm.storageLocationEnabled}
                  >
                    <option value="">Lagerort waehlen</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 rounded-xl border border-workshop-200 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={bulkForm.storageAreaEnabled}
                      onChange={(e) => setBulkForm((prev) => ({ ...prev, storageAreaEnabled: e.target.checked }))}
                    />
                    Regal setzen
                  </label>
                  <select
                    className="input h-10 min-h-0"
                    value={bulkForm.storageArea}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, storageArea: e.target.value }))}
                    disabled={!bulkForm.storageAreaEnabled || !bulkForm.storageLocationId}
                  >
                    <option value="">
                      {!bulkForm.storageLocationId
                        ? "Erst Lagerort waehlen"
                        : availableBulkShelves.length
                        ? "Kein Regal"
                        : "Keine Regale fuer Lagerort"}
                    </option>
                    {availableBulkShelves.map((shelf) => (
                      <option key={shelf.id} value={shelf.name}>
                        {shelf.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 rounded-xl border border-workshop-200 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={bulkForm.binEnabled}
                      onChange={(e) => setBulkForm((prev) => ({ ...prev, binEnabled: e.target.checked }))}
                    />
                    Fach setzen
                  </label>
                  <input
                    className="input h-10 min-h-0"
                    value={bulkForm.bin}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, bin: e.target.value }))}
                    disabled={!bulkForm.binEnabled}
                    placeholder="Leer = Fach entfernen"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-workshop-200 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={bulkForm.tagsEnabled}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, tagsEnabled: e.target.checked }))}
                  />
                  Tags ersetzen
                </label>
                <p className="text-xs text-workshop-700">Wenn aktiv, wird die Tag-Auswahl fuer alle markierten Items exakt auf diesen Stand gesetzt.</p>
                {bulkForm.tagsEnabled && (
                  tags.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-workshop-200 px-3 py-2 text-sm text-workshop-700">Keine Tags vorhanden.</p>
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
                          onClick={() => toggleBulkTag(tag.id)}
                        >
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-workshop-200 px-4 py-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary w-full sm:w-auto" onClick={resetBulkEditor}>
                Abbrechen
              </button>
              <button type="button" className="btn w-full sm:w-auto" onClick={applyBulkEdit} disabled={bulkSaving}>
                {bulkSaving ? "Speichert..." : "Aenderungen uebernehmen"}
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
                <p className="text-base font-semibold">Items loeschen</p>
                <p className="mt-1 text-sm text-workshop-700">
                  {selected.length} markierte Items werden in den Papierkorb verschoben und bleiben dort {TRASH_RETENTION_DAYS} Tage lang wiederherstellbar.
                </p>
              </div>
              {bulkDeleteError && <p className="theme-status-danger rounded-lg border border-transparent px-3 py-2 text-sm">{bulkDeleteError}</p>}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-workshop-200 px-4 py-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary w-full sm:w-auto" onClick={resetBulkDelete}>
                Abbrechen
              </button>
              <button
                type="button"
                className="theme-status-danger w-full rounded-lg border border-transparent px-4 py-2 text-sm font-medium sm:w-auto"
                onClick={applyBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? "Loescht..." : "In Papierkorb verschieben"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
