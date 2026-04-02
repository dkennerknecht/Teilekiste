"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppLanguage } from "@/components/app-language-provider";
import {
  StorageBinSelectField,
  StorageBinSlotSelectField,
  StorageLocationSelectField,
  StorageShelfSelectField
} from "@/components/storage-select-fields";
import { translateApiErrorMessage } from "@/lib/app-language";
import { CustomFieldsEditor } from "@/components/custom-fields-editor";
import type { CustomFieldRow, CustomFieldValueMap } from "@/lib/custom-fields";
import { getQuantityStep, getUnitDisplayLabel } from "@/lib/quantity";
import {
  getBinsForShelf,
  getShelvesForLocation,
  storageBinRequiresSlot,
  type StorageBinOption,
  type StorageLocationOption,
  type StorageShelfOption
} from "@/lib/storage-ui";

type Option = { id: string; name: string; code?: string; codeLabel?: string };

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function NewItemPage() {
  const router = useRouter();
  const { language } = useAppLanguage();
  const tr = (de: string, en: string) => (language === "en" ? en : de);
  const [categories, setCategories] = useState<Option[]>([]);
  const [locations, setLocations] = useState<StorageLocationOption[]>([]);
  const [shelves, setShelves] = useState<StorageShelfOption[]>([]);
  const [bins, setBins] = useState<StorageBinOption[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [tags, setTags] = useState<Option[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([]);
  const [labelPreview, setLabelPreview] = useState("");
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; labelCode: string; name: string; score: number; reasons: string[] }>
  >([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasRequiredMeta = categories.length > 0 && types.length > 0;
  const [form, setForm] = useState({
    name: "",
    description: "",
    categoryId: "",
    placementStatus: "PLACED",
    storageLocationId: "",
    storageShelfId: "",
    storageArea: "",
    storageBinId: "",
    binSlot: "",
    stock: 0,
    incomingQty: 0,
    unit: "STK",
    minStock: "",
    manufacturer: "",
    mpn: "",
    typeId: "",
    tagIds: [] as string[],
    customValues: {} as CustomFieldValueMap
  });

  useEffect(() => {
    const load = async () => {
      const { categories: cat, locations: loc, shelves: sh, bins: bn, types: ty, tags: tg, customFields: cf } = await fetch("/api/meta").then((r) => r.json());
      setCategories(cat);
      setLocations(loc);
      setShelves(sh || []);
      setBins((bn || []).filter((entry: StorageBinOption) => entry.isActive !== false));
      setTypes(ty);
      setTags(tg || []);
      setCustomFields(cf || []);
      if (cat[0]) setForm((f) => ({ ...f, categoryId: cat[0].id }));
      if (loc[0]) setForm((f) => ({ ...f, storageLocationId: f.storageLocationId || loc[0].id }));
      if (ty[0]) setForm((f) => ({ ...f, typeId: ty[0].id }));
    };
    load();
  }, []);

  useEffect(() => {
    if (!form.storageLocationId) return;
    const hasShelf = shelves.some((shelf) => shelf.id === form.storageShelfId && shelf.storageLocationId === form.storageLocationId);
    if (form.storageShelfId && !hasShelf) {
      setForm((prev) => ({ ...prev, storageShelfId: "", storageArea: "", storageBinId: "", binSlot: "" }));
    }
  }, [form.storageShelfId, form.storageLocationId, shelves]);

  useEffect(() => {
    if (!form.storageBinId) return;
    const selectedBin = bins.find((entry) => entry.id === form.storageBinId);
    if (!selectedBin) {
      setForm((prev) => ({ ...prev, storageBinId: "", binSlot: "" }));
      return;
    }
    const selectedShelf = shelves.find((shelf) => shelf.id === selectedBin.storageShelfId);
    if (form.storageLocationId !== selectedBin.storageLocationId || form.storageShelfId !== selectedBin.storageShelfId) {
      setForm((prev) => ({
        ...prev,
        storageLocationId: selectedBin.storageLocationId,
        storageShelfId: selectedBin.storageShelfId,
        storageArea: selectedShelf?.name || selectedBin.storageArea || ""
      }));
    }
    if ((selectedBin.slotCount <= 1 && form.binSlot) || (form.binSlot && Number(form.binSlot) > selectedBin.slotCount)) {
      setForm((prev) => ({ ...prev, binSlot: "" }));
    }
  }, [bins, shelves, form.storageBinId, form.storageLocationId, form.storageShelfId, form.binSlot]);

  const availableShelves = getShelvesForLocation(shelves, form.storageLocationId);
  const selectedShelf = shelves.find((shelf) => shelf.id === form.storageShelfId) || null;
  const availableBins = getBinsForShelf(bins, form.storageShelfId);
  const selectedBin = bins.find((entry) => entry.id === form.storageBinId) || null;
  const isPlaced = form.placementStatus === "PLACED";
  const usesManagedDrawer = isPlaced && selectedShelf?.mode === "DRAWER_HOST";
  const selectedBinRequiresSlot = storageBinRequiresSlot(selectedBin);

  useEffect(() => {
    if (!form.categoryId || !form.typeId) return;
    fetch(`/api/label/preview?categoryId=${form.categoryId}&typeId=${form.typeId}`)
      .then((r) => r.json())
      .then((d) => setLabelPreview(d.preview || ""));
  }, [form.categoryId, form.typeId]);

  useEffect(() => {
    if (!form.name && !form.mpn && !form.manufacturer) {
      setDuplicates([]);
      return;
    }
    fetch(
      `/api/items/duplicates?name=${encodeURIComponent(form.name)}&manufacturer=${encodeURIComponent(form.manufacturer)}&mpn=${encodeURIComponent(form.mpn)}&categoryId=${encodeURIComponent(form.categoryId)}&typeId=${encodeURIComponent(form.typeId)}&storageLocationId=${encodeURIComponent(form.storageLocationId)}&unit=${encodeURIComponent(form.unit)}`
    )
      .then((r) => r.json())
      .then(setDuplicates);
  }, [form.name, form.manufacturer, form.mpn, form.categoryId, form.typeId, form.storageLocationId, form.unit]);

  async function createTag() {
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

    if (!res.ok || !data?.id) {
      alert(translateApiErrorMessage(language, data?.error) || tr("Tag anlegen fehlgeschlagen", "Failed to create tag"));
      return;
    }

    setTags((prev) => (prev.some((tag) => tag.id === data.id) ? prev : [...prev, data].sort((a, b) => a.name.localeCompare(b.name))));
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(data.id) ? prev.tagIds : [...prev.tagIds, data.id]
    }));
    setNewTagName("");
  }

  function handleImageSelection(files: FileList | null) {
    if (!files?.length) return;

    const incoming = Array.from(files);
    const rejected = incoming.filter((file) => !allowedImageTypes.has(file.type));
    if (rejected.length > 0) {
      alert(
        language === "en"
          ? `These file types are not supported: ${rejected.map((file) => file.name).join(", ")}`
          : `Diese Dateitypen werden nicht unterstuetzt: ${rejected.map((file) => file.name).join(", ")}`
      );
    }

    setSelectedImages((prev) => {
      const existing = new Set(prev.map(fileKey));
      const next = incoming.filter((file) => allowedImageTypes.has(file.type) && !existing.has(fileKey(file)));
      return next.length > 0 ? [...prev, ...next] : prev;
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{tr("Neues Item", "New Item")}</h1>
      <div className="card">
        <div className="mb-2 text-sm text-workshop-700">
          {tr("Code-Vorschau", "Code preview")}: <span className="font-mono">{labelPreview || "-"}</span>
        </div>
        {!hasRequiredMeta && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-100 p-2 text-sm text-amber-950">
            {tr("Fuer neue Items wird mindestens eine Kategorie, ein Type und ein Lagerort benoetigt. Fehlende Lagerorte kannst du unter Admin anlegen.", "New items require at least one category, one type, and one storage location. Missing locations can be created in Admin.")}
          </div>
        )}
        {duplicates.length > 0 && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-100 p-3 text-sm text-amber-950">
            <p className="font-medium">{tr("Moegliche Duplikate", "Possible duplicates")}</p>
            <ul className="mt-2 space-y-1">
              {duplicates.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/items/${d.id}`}
                    className="font-medium underline decoration-amber-800 underline-offset-2 hover:text-amber-700"
                  >
                    {d.labelCode}
                  </Link>{" "}
                  <span>
                    {d.name} ({d.score}, {d.reasons.join("/")})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            try {
              const payload = {
                ...form,
                storageLocationId: isPlaced ? form.storageLocationId || null : null,
                storageShelfId: isPlaced ? form.storageShelfId || null : null,
                storageArea: isPlaced ? selectedShelf?.name || form.storageArea || null : null,
                storageBinId: usesManagedDrawer ? form.storageBinId || null : null,
                binSlot: usesManagedDrawer && form.binSlot !== "" ? Number(form.binSlot) : null,
                minStock: form.minStock === "" ? null : Number(form.minStock)
              };
              const res = await fetch("/api/items", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload)
              });
              if (res.ok) {
                const item = await res.json();
                const failedUploads: string[] = [];

                for (const image of selectedImages) {
                  const uploadData = new FormData();
                  uploadData.set("file", image);

                  const uploadRes = await fetch(`/api/items/${item.id}/images`, {
                    method: "POST",
                    body: uploadData
                  });

                  if (!uploadRes.ok) failedUploads.push(image.name);
                }

                if (failedUploads.length > 0) {
                  alert(
                    language === "en"
                      ? `Item created, but these images could not be uploaded: ${failedUploads.join(", ")}`
                      : `Item angelegt, aber diese Bilder konnten nicht hochgeladen werden: ${failedUploads.join(", ")}`
                  );
                }

                router.push(`/items/${item.id}`);
                return;
              }

              const error = await res.json().catch(() => null);
              alert(translateApiErrorMessage(language, error?.error) || tr("Anlegen fehlgeschlagen", "Create failed"));
            } catch {
              alert(tr("Anlegen fehlgeschlagen", "Create failed"));
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label className="text-sm">
            {tr("Name", "Name")}
            <input
              className="input mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              disabled={!hasRequiredMeta}
            />
          </label>

          <label className="text-sm">
            {tr("Hersteller", "Manufacturer")}
            <input className="input mt-1" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} disabled={!hasRequiredMeta} />
          </label>

          <label className="text-sm md:col-span-1">
            {tr("Beschreibung", "Description")}
            <textarea
              className="input mt-1 min-h-28"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              disabled={!hasRequiredMeta}
            />
          </label>

          <label className="text-sm">
            MPN
            <input className="input mt-1" value={form.mpn} onChange={(e) => setForm({ ...form, mpn: e.target.value })} disabled={!hasRequiredMeta} />
          </label>

          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <label className="text-sm">
            {tr("Kategorie", "Category")}
            <select className="input mt-1" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} disabled={!hasRequiredMeta} required>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code} - ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              {tr("Type (Label)", "Type (Label)")}
              <select className="input mt-1" value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })} disabled={!hasRequiredMeta} required>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} - {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
            <label className="text-sm">
              {tr("Status", "Status")}
              <select
                className="input mt-1"
                value={form.placementStatus}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    placementStatus: e.target.value,
                    ...(e.target.value !== "PLACED"
                      ? { storageLocationId: "", storageShelfId: "", storageArea: "", storageBinId: "", binSlot: "" }
                      : {})
                  }))
                }
                disabled={!hasRequiredMeta}
              >
                <option value="PLACED">{tr("Eingelagert", "Placed")}</option>
                <option value="UNPLACED">{tr("Vorhanden, aber ohne Platz", "On hand, but unplaced")}</option>
                <option value="INCOMING">{tr("Erwartet / bestellt", "Incoming / expected")}</option>
              </select>
            </label>

            <StorageLocationSelectField
              label={tr("Lagerort", "Storage location")}
              value={form.storageLocationId}
              options={locations}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  storageLocationId: value,
                  storageShelfId: "",
                  storageArea: "",
                  storageBinId: "",
                  binSlot: ""
                }))
              }
              emptyLabel={tr("Kein Lagerort", "No storage location")}
              disabled={!hasRequiredMeta || !isPlaced}
            />

            <StorageShelfSelectField
              label={tr("Regal / Bereich", "Shelf / area")}
              value={form.storageShelfId}
              shelves={availableShelves}
              onChange={(value) => {
                const nextShelf = shelves.find((shelf) => shelf.id === value) || null;
                setForm((prev) => ({
                  ...prev,
                  storageShelfId: value,
                  storageArea: nextShelf?.name || "",
                  storageBinId: "",
                  binSlot: ""
                }));
              }}
              emptyLabel={availableShelves.length ? tr("Kein Regal", "No shelf") : tr("Keine Regale fuer Lagerort", "No shelves for location")}
              disabled={!hasRequiredMeta || !isPlaced || !form.storageLocationId || availableShelves.length === 0}
            />
          </div>

          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <StorageBinSelectField
              label={tr("Drawer", "Drawer")}
              value={form.storageBinId}
              bins={availableBins}
              shelves={shelves}
              onChange={(value) => setForm((prev) => ({ ...prev, storageBinId: value, binSlot: "" }))}
              emptyLabel={usesManagedDrawer ? tr("Drawer waehlen", "Choose drawer") : tr("Regal ohne Drawer", "Shelf without drawers")}
              disabled={!hasRequiredMeta || !isPlaced || !usesManagedDrawer}
            />

            <StorageBinSlotSelectField
              label={tr("Unterfach", "Slot")}
              value={form.binSlot}
              selectedBin={selectedBin}
              shelves={shelves}
              onChange={(value) => setForm((prev) => ({ ...prev, binSlot: value }))}
              emptyLabel={
                !selectedBin
                  ? tr("Erst Drawer waehlen", "Choose drawer first")
                  : selectedBinRequiresSlot
                    ? tr("Unterfach waehlen", "Choose slot")
                    : tr("Kein Unterfach erforderlich", "No slot required")
              }
              disabled={!hasRequiredMeta || !usesManagedDrawer || !selectedBin || !selectedBinRequiresSlot}
            />
          </div>

          <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
            <label className="text-sm">
              {tr("Bestand", "Stock")} ({getUnitDisplayLabel(form.unit)})
              <input
                className="input mt-1"
                type="number"
                step={getQuantityStep(form.unit)}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                disabled={!hasRequiredMeta}
              />
            </label>

            <label className="text-sm">
              {tr("Erwartete Menge", "Incoming quantity")} ({getUnitDisplayLabel(form.unit)})
              <input
                className="input mt-1"
                type="number"
                step={getQuantityStep(form.unit)}
                value={form.incomingQty}
                onChange={(e) => setForm({ ...form, incomingQty: Number(e.target.value) })}
                disabled={!hasRequiredMeta}
              />
            </label>

            <label className="text-sm">
              {tr("Einheit", "Unit")}
              <select className="input mt-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} disabled={!hasRequiredMeta}>
                <option value="STK">Stk</option>
                <option value="M">m</option>
                <option value="SET">Set</option>
                <option value="PACK">Pack</option>
              </select>
            </label>

            <label className="text-sm">
              {tr("Mindestbestand", "Minimum stock")} ({getUnitDisplayLabel(form.unit)})
              <input
                className="input mt-1"
                type="number"
                step={getQuantityStep(form.unit)}
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                placeholder={tr("leer = kein Mindestbestand", "empty = no minimum stock")}
                disabled={!hasRequiredMeta}
              />
            </label>
          </div>

          <CustomFieldsEditor
            fields={customFields}
            values={form.customValues}
            categoryId={form.categoryId}
            typeId={form.typeId}
            disabled={!hasRequiredMeta}
            onChange={(customValues) => setForm((prev) => ({ ...prev, customValues }))}
          />

          <fieldset className="text-sm md:col-span-2">
            <legend className="mb-1">{tr("Tags", "Tags")}</legend>
            {tags.length === 0 ? (
              <p className="rounded-md border border-dashed border-workshop-200 px-3 py-2 text-workshop-700">{tr("Noch keine Tags vorhanden.", "No tags available yet.")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <label key={tag.id} className="inline-flex items-center gap-1 rounded border border-workshop-200 px-2 py-1">
                    <input
                      type="checkbox"
                      checked={form.tagIds.includes(tag.id)}
                      disabled={!hasRequiredMeta}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          tagIds: e.target.checked
                            ? [...new Set([...prev.tagIds, tag.id])]
                            : prev.tagIds.filter((id: string) => id !== tag.id)
                        }))
                      }
                    />
                    <span>{tag.name}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                className="input flex-1"
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder={tr("Neuen Tag anlegen", "Create new tag")}
                disabled={!hasRequiredMeta}
              />
              <button type="button" className="btn-secondary" onClick={createTag} disabled={!hasRequiredMeta || creatingTag || !newTagName.trim()}>
                {creatingTag ? tr("Tag wird angelegt...", "Creating tag...") : tr("Tag anlegen", "Create tag")}
              </button>
            </div>
          </fieldset>

          <fieldset className="text-sm md:col-span-2">
            <legend className="mb-1">{tr("Bilder", "Images")}</legend>
            <p className="mb-2 text-workshop-700">{tr("Du kannst Bilder direkt mit anlegen. Das erste erfolgreiche Upload wird spaeter das Titelbild.", "You can add images right away. The first successful upload becomes the cover image later.")}</p>
            <input
              className="input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              disabled={!hasRequiredMeta}
              onChange={(e) => {
                handleImageSelection(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            {selectedImages.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedImages.map((image, index) => (
                  <div key={fileKey(image)} className="flex items-center justify-between gap-3 rounded border border-workshop-200 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{image.name}</p>
                      <p className="text-xs text-workshop-700">
                        {tr("Bild", "Image")} {index + 1} - {formatFileSize(image.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setSelectedImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index))}
                    >
                      {tr("Entfernen", "Remove")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          <button className="btn md:col-span-2" type="submit" disabled={submitting || !hasRequiredMeta}>
            {submitting ? tr("Speichere...", "Saving...") : tr("Speichern", "Save")}
          </button>
        </form>
      </div>
    </div>
  );
}
