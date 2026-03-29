"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomFieldsEditor } from "@/components/custom-fields-editor";
import type { CustomFieldRow, CustomFieldValueMap } from "@/lib/custom-fields";
import { getQuantityStep, getUnitDisplayLabel } from "@/lib/quantity";

type Option = { id: string; name: string; code?: string; codeLabel?: string };
type ShelfOption = { id: string; name: string; storageLocationId: string };

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
  const [categories, setCategories] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
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
  const hasRequiredMeta = categories.length > 0 && locations.length > 0 && types.length > 0;
  const [form, setForm] = useState({
    name: "",
    description: "",
    categoryId: "",
    storageLocationId: "",
    storageArea: "",
    bin: "",
    stock: 0,
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
      const { categories: cat, locations: loc, shelves: sh, types: ty, tags: tg, customFields: cf } = await fetch("/api/meta").then((r) => r.json());
      setCategories(cat);
      setLocations(loc);
      setShelves(sh || []);
      setTypes(ty);
      setTags(tg || []);
      setCustomFields(cf || []);
      if (cat[0]) setForm((f) => ({ ...f, categoryId: cat[0].id }));
      if (loc[0]) setForm((f) => ({ ...f, storageLocationId: loc[0].id }));
      if (ty[0]) setForm((f) => ({ ...f, typeId: ty[0].id }));
    };
    load();
  }, []);

  useEffect(() => {
    if (!form.storageLocationId) return;
    const hasShelf = shelves.some((shelf) => shelf.storageLocationId === form.storageLocationId && shelf.name === form.storageArea);
    if (form.storageArea && !hasShelf) {
      setForm((prev) => ({ ...prev, storageArea: "" }));
    }
  }, [form.storageArea, form.storageLocationId, shelves]);

  const availableShelves = shelves.filter((shelf) => shelf.storageLocationId === form.storageLocationId);

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
      `/api/items/duplicates?name=${encodeURIComponent(form.name)}&manufacturer=${encodeURIComponent(form.manufacturer)}&mpn=${encodeURIComponent(form.mpn)}&categoryId=${encodeURIComponent(form.categoryId)}&typeId=${encodeURIComponent(form.typeId)}&unit=${encodeURIComponent(form.unit)}`
    )
      .then((r) => r.json())
      .then(setDuplicates);
  }, [form.name, form.manufacturer, form.mpn, form.categoryId, form.typeId, form.unit]);

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
      alert(data?.error || "Tag anlegen fehlgeschlagen");
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
      alert(`Diese Dateitypen werden nicht unterstuetzt: ${rejected.map((file) => file.name).join(", ")}`);
    }

    setSelectedImages((prev) => {
      const existing = new Set(prev.map(fileKey));
      const next = incoming.filter((file) => allowedImageTypes.has(file.type) && !existing.has(fileKey(file)));
      return next.length > 0 ? [...prev, ...next] : prev;
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Neues Item</h1>
      <div className="card">
        <div className="mb-2 text-sm text-workshop-700">
          Code-Vorschau: <span className="font-mono">{labelPreview || "-"}</span>
        </div>
        {!hasRequiredMeta && (
          <div className="mb-3 rounded-md border border-yellow-500 bg-yellow-50 p-2 text-sm">
            Fuer neue Items wird mindestens eine Kategorie, ein Type und ein Lagerort benoetigt. Fehlende Lagerorte kannst du unter Admin anlegen.
          </div>
        )}
        {duplicates.length > 0 && (
          <div className="mb-3 rounded-md border border-yellow-500 bg-yellow-50 p-2 text-sm">
            Moegliche Duplikate: {duplicates.map((d) => `${d.labelCode} (${d.score}, ${d.reasons.join("/")})`).join(", ")}
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
                  alert(`Item angelegt, aber diese Bilder konnten nicht hochgeladen werden: ${failedUploads.join(", ")}`);
                }

                router.push(`/items/${item.id}`);
                return;
              }

              const error = await res.json().catch(() => null);
              alert(error?.error || "Anlegen fehlgeschlagen");
            } catch {
              alert("Anlegen fehlgeschlagen");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label className="text-sm">
            Name
            <input
              className="input mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              disabled={!hasRequiredMeta}
            />
          </label>

          <label className="text-sm">
            Hersteller
            <input className="input mt-1" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} disabled={!hasRequiredMeta} />
          </label>

          <label className="text-sm md:col-span-1">
            Beschreibung
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
              Kategorie
              <select className="input mt-1" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} disabled={!hasRequiredMeta} required>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code} - ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Type (Label)
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
              Lagerort
              <select
                className="input mt-1"
                value={form.storageLocationId}
                onChange={(e) => setForm({ ...form, storageLocationId: e.target.value, storageArea: "" })}
                disabled={!hasRequiredMeta}
                required
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Regal / Bereich
              <select
                className="input mt-1"
                value={form.storageArea}
                onChange={(e) => setForm({ ...form, storageArea: e.target.value })}
                disabled={!hasRequiredMeta || !form.storageLocationId || availableShelves.length === 0}
              >
                <option value="">{availableShelves.length ? "Kein Regal" : "Keine Regale fuer Lagerort"}</option>
                {availableShelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.name}>
                    {shelf.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Fach / Bin
              <input className="input mt-1" value={form.bin} onChange={(e) => setForm({ ...form, bin: e.target.value })} disabled={!hasRequiredMeta} />
            </label>
          </div>

          <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
            <label className="text-sm">
              Bestand ({getUnitDisplayLabel(form.unit)})
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
              Einheit
              <select className="input mt-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} disabled={!hasRequiredMeta}>
                <option value="STK">Stk</option>
                <option value="M">m</option>
                <option value="SET">Set</option>
                <option value="PACK">Pack</option>
              </select>
            </label>

            <label className="text-sm">
              Mindestbestand ({getUnitDisplayLabel(form.unit)})
              <input
                className="input mt-1"
                type="number"
                step={getQuantityStep(form.unit)}
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                placeholder="leer = kein Mindestbestand"
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
            <legend className="mb-1">Tags</legend>
            {tags.length === 0 ? (
              <p className="rounded-md border border-dashed border-workshop-200 px-3 py-2 text-workshop-700">Noch keine Tags vorhanden.</p>
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
                placeholder="Neuen Tag anlegen"
                disabled={!hasRequiredMeta}
              />
              <button type="button" className="btn-secondary" onClick={createTag} disabled={!hasRequiredMeta || creatingTag || !newTagName.trim()}>
                {creatingTag ? "Tag wird angelegt..." : "Tag anlegen"}
              </button>
            </div>
          </fieldset>

          <fieldset className="text-sm md:col-span-2">
            <legend className="mb-1">Bilder</legend>
            <p className="mb-2 text-workshop-700">Du kannst Bilder direkt mit anlegen. Das erste erfolgreiche Upload wird spaeter das Titelbild.</p>
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
                        Bild {index + 1} - {formatFileSize(image.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setSelectedImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index))}
                    >
                      Entfernen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          <button className="btn md:col-span-2" type="submit" disabled={submitting || !hasRequiredMeta}>
            {submitting ? "Speichere..." : "Speichern"}
          </button>
        </form>
      </div>
    </div>
  );
}
