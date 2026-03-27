"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import {
  ArrowLeft,
  CalendarDays,
  FolderOpen,
  Layers,
  Tag,
  User,
  Barcode,
  Trash2,
  PencilLine,
  Save,
  X,
  MapPin,
  Package2,
  Minus,
  Plus
} from "lucide-react";
import { ItemImageGallery } from "@/components/item-image-gallery";
import { ItemBomSection } from "@/components/item-bom-section";
import { ItemAuditSection } from "@/components/item-audit-section";
import { resolveCategoryCode } from "@/lib/label-catalog";
import { CustomFieldsEditor } from "@/components/custom-fields-editor";
import { buildCustomValueMap, formatCustomFieldValue, parseStoredCustomFieldValue, type CustomFieldRow } from "@/lib/custom-fields";

type TagOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; code?: string | null };
type LocationOption = { id: string; name: string; code?: string | null };
type ShelfOption = { id: string; name: string; storageLocationId: string };
type TypeOption = { id: string; code: string; name: string };

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
    barcodeEan: data.barcodeEan || "",
    tagIds: (data.tags || []).map((t: any) => t.tagId),
    typeId: "",
    labelNumber: "",
    customValues: buildCustomValueMap(data.customValues || [])
  };
}

export default function ItemDetailPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [types, setTypes] = useState<TypeOption[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([]);
  const [labelCfg, setLabelCfg] = useState({ separator: "-", digits: 3 });
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState("PURCHASE");
  const [note, setNote] = useState("");
  const [reservedQty, setReservedQty] = useState(1);
  const [reservedFor, setReservedFor] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/items/${params.id}`, { cache: "no-store" });
    const data = await res.json();
    setItem(data);
    setForm(buildItemFormState(data));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!editMode) return;
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
    fetch("/api/admin/label-config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg) {
          setLabelCfg({
            separator: cfg.separator || "-",
            digits: Number(cfg.digits || 3)
          });
        }
      })
      .catch(() => null);
  }, [editMode]);

  useEffect(() => {
    if (!editMode || !item || !types.length) return;
    if (form.typeId) return;

    const parts = String(item.labelCode || "").split(labelCfg.separator);
    if (parts.length < 2) return;
    const typeCode = parts[parts.length - 2];
    const numPart = parts[parts.length - 1];
    const type = types.find((t) => t.code === typeCode);
    setForm((prev: any) => ({
      ...prev,
      typeId: type?.id || prev.typeId,
      labelNumber: /^\\d+$/.test(numPart) ? numPart : prev.labelNumber
    }));
  }, [editMode, item, types, labelCfg.separator, form?.typeId]);

  const history = useMemo(() => {
    if (!item) return [];
    const movements = (item.movements || []).map((m: any) => ({
      id: `m-${m.id}`,
      createdAt: m.createdAt,
      text: `${m.delta > 0 ? `+${m.delta}` : m.delta} (${m.reason}) ${m.note || ""}`.trim()
    }));
    const reservations = (item.reservations || []).map((r: any) => ({
      id: `r-${r.id}`,
      createdAt: r.createdAt,
      text: `Reservierung: ${r.reservedQty} x ${r.reservedFor}`
    }));
    return [...movements, ...reservations].sort(
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

  return (
    <div className="space-y-4 text-[var(--app-text)]">
      <div className="rounded-xl border border-workshop-200 bg-workshop-50 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <button className="mt-0.5 text-workshop-800" onClick={() => window.history.back()}>
              <ArrowLeft size={22} />
            </button>
            <div>
              <p className="theme-muted text-sm">Inventar / {item.category?.name || "Item"}</p>
              <h1 className="text-xl font-semibold leading-6 text-[var(--app-text)]">{editMode ? "Item bearbeiten" : "Item Details"}</h1>
              {item.isArchived && (
                <span className="theme-status-warning mt-2 inline-flex rounded-full border border-transparent px-3 py-1 text-xs font-medium">
                  Archiviert
                </span>
              )}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {editMode ? (
              <>
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-workshop-300 bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text)] sm:w-auto"
                  onClick={() => {
                    setEditMode(false);
                    setSaveError("");
                    setForm(buildItemFormState(item));
                  }}
                >
                  <X size={16} /> Abbrechen
                </button>
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-primary)] px-4 py-2 text-sm font-medium text-[var(--app-on-primary)] sm:w-auto"
                  disabled={saveBusy}
                  onClick={async () => {
                    setSaveBusy(true);
                    setSaveError("");
                    try {
                      const selectedCategory = categories.find((c) => c.id === form.categoryId);
                      const selectedType = types.find((t) => t.id === form.typeId);
                      const nextLabelCode =
                        selectedCategory && selectedType && String(form.labelNumber || "").trim()
                          ? `${resolveCategoryCode(selectedCategory)}${labelCfg.separator}${selectedType.code}${labelCfg.separator}${String(form.labelNumber).padStart(labelCfg.digits, "0")}`
                          : undefined;
                      const payload = {
                        name: form.name,
                        description: form.description,
                        categoryId: form.categoryId,
                        storageLocationId: form.storageLocationId,
                        storageArea: form.storageArea,
                        bin: form.bin,
                        manufacturer: form.manufacturer,
                        mpn: form.mpn,
                        barcodeEan: form.barcodeEan,
                        tagIds: form.tagIds,
                        minStock: form.minStock === "" ? null : Number(form.minStock),
                        customValues: form.customValues,
                        ...(selectedType ? { typeId: selectedType.id } : {}),
                        ...(nextLabelCode ? { labelCode: nextLabelCode } : {})
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-workshop-300 bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text)] sm:w-auto"
                  onClick={() => setArchiveState(!item.isArchived)}
                  disabled={archiveBusy}
                >
                  {archiveBusy ? (item.isArchived ? "Stellt wieder her..." : "Archiviert...") : item.isArchived ? "Wiederherstellen" : "Archivieren"}
                </button>
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-primary)] px-4 py-2 text-sm font-medium text-[var(--app-on-primary)] sm:w-auto"
                  onClick={() => setEditMode(true)}
                >
                  <PencilLine size={16} /> Bearbeiten
                </button>
              </>
            )}
          </div>
        </div>
        {archiveError && <p className="mt-3 text-sm text-red-700">{archiveError}</p>}
        {saveError && <p className="mt-3 text-sm text-red-700">{saveError}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section>
          <ItemImageGallery
            itemId={item.id}
            itemName={item.name}
            images={item.images || []}
            editMode={editMode}
            onReload={load}
          />
        </section>

        <section className="space-y-3">
          <div className="theme-muted grid grid-cols-1 gap-2 rounded-xl border border-workshop-200 bg-workshop-50 p-3 text-sm sm:text-[16px] md:grid-cols-3">
            <div className="inline-flex items-center gap-2"><CalendarDays size={15} /> Erstellt: {new Date(item.createdAt).toLocaleDateString("de-DE")}</div>
            <div className="inline-flex items-center gap-2"><CalendarDays size={15} /> Zuletzt bearbeitet: {new Date(item.updatedAt).toLocaleDateString("de-DE")}</div>
            <div className="inline-flex items-center gap-2"><User size={15} /> von {owner}</div>
          </div>

          <div className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-4">
            <h2 className="mb-4 inline-flex items-center gap-2 text-[26px] font-semibold text-[var(--app-text)] sm:text-[34px]"><FolderOpen size={18} /> Details</h2>

            <div className="space-y-4 text-[var(--app-text)]">
              <div>
                <p className="theme-muted mb-1 text-[18px] font-medium">Name</p>
                {editMode ? (
                  <input className="input text-lg" value={form.name} onChange={(e) => setForm((v: any) => ({ ...v, name: e.target.value }))} />
                ) : (
                  <p className="text-xl">{item.name}</p>
                )}
              </div>

              <div>
                <p className="theme-muted mb-1 text-[18px] font-medium"># ID</p>
                {editMode ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 md:grid-cols-2">
                      <select className="input" value={form.typeId} onChange={(e) => setForm((v: any) => ({ ...v, typeId: e.target.value }))}>
                        <option value="">Type (Label)</option>
                        {types.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.code} - {t.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={form.labelNumber}
                        placeholder="Nummer (z.B. 002)"
                        onChange={(e) => setForm((v: any) => ({ ...v, labelNumber: e.target.value }))}
                      />
                    </div>
                    <p className="theme-muted text-sm font-mono">
                      Vorschau:{" "}
                      {(() => {
                        const selectedCategory = categories.find((c) => c.id === form.categoryId);
                        const selectedType = types.find((t) => t.id === form.typeId);
                        if (!selectedCategory || !selectedType || !String(form.labelNumber || "").trim()) return item.labelCode;
                        return `${resolveCategoryCode(selectedCategory)}${labelCfg.separator}${selectedType.code}${labelCfg.separator}${String(form.labelNumber).padStart(labelCfg.digits, "0")}`;
                      })()}
                    </p>
                  </div>
                ) : (
                  <p className="text-xl font-mono">{item.labelCode}</p>
                )}
              </div>

              <div>
                <p className="theme-muted mb-1 text-[18px] font-medium">Beschreibung</p>
                {editMode ? (
                  <textarea className="input min-h-28" value={form.description} onChange={(e) => setForm((v: any) => ({ ...v, description: e.target.value }))} />
                ) : (
                  <div className="text-lg leading-8 text-[var(--app-text)]">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{item.description || "-"}</ReactMarkdown>
                  </div>
                )}
              </div>

              <div className="grid gap-4 border-t border-workshop-200 pt-4 md:grid-cols-2">
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

                <div>
                  <p className="theme-muted mb-1 text-[18px] font-medium">Hersteller</p>
                  {editMode ? (
                    <input className="input" value={form.manufacturer} onChange={(e) => setForm((v: any) => ({ ...v, manufacturer: e.target.value }))} />
                  ) : (
                    <p className="text-lg font-medium text-[var(--app-text)]">{item.manufacturer || "-"}</p>
                  )}
                </div>

                <div>
                  <p className="theme-muted mb-1 text-[18px] font-medium">MPN</p>
                  {editMode ? (
                    <input className="input" value={form.mpn} onChange={(e) => setForm((v: any) => ({ ...v, mpn: e.target.value }))} />
                  ) : (
                  <p className="text-lg font-mono text-[var(--app-text)]">{item.mpn || "-"}</p>
                )}
              </div>

              <div>
                  <p className="theme-muted mb-1 inline-flex items-center gap-2 text-[18px] font-medium"><Barcode size={15} /> EAN</p>
                  {editMode ? (
                    <input className="input" value={form.barcodeEan} onChange={(e) => setForm((v: any) => ({ ...v, barcodeEan: e.target.value }))} />
                  ) : (
                    <p className="text-lg font-mono text-[var(--app-text)]">{item.barcodeEan || "-"}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 border-t border-workshop-200 pt-4 md:grid-cols-2">
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
                    <p className="text-lg text-[var(--app-text)]">{item.storageArea || "-"}</p>
                  )}
                </div>
                <div>
                  <p className="theme-muted mb-1 text-[18px] font-medium">Fach / Bin</p>
                  {editMode ? (
                    <input className="input" value={form.bin} onChange={(e) => setForm((v: any) => ({ ...v, bin: e.target.value }))} />
                  ) : (
                    <p className="text-lg text-[var(--app-text)]">{item.bin || "-"}</p>
                  )}
                </div>
              </div>

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
                    {(item.tags || []).length ? (
                      item.tags.map((t: any) => (
                        <span key={t.tag.id} className="rounded-full border border-workshop-200 bg-workshop-50 px-3 py-1 text-sm font-medium">
                          {t.tag.name}
                        </span>
                      ))
                    ) : (
                      <span className="theme-muted text-sm">Keine Tags</span>
                    )}
                  </div>
                )}
              </div>

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
                ) : itemCustomValues.length ? (
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
                ) : (
                  <p className="theme-muted text-sm">Keine Custom Fields gepflegt.</p>
                )}
              </div>

              <div className="grid gap-4 border-t border-workshop-200 pt-4 md:grid-cols-3">
                <div>
                  <p className="theme-muted mb-1 inline-flex items-center gap-2 text-[18px] font-medium"><MapPin size={15} /> Ort</p>
                  <p className="text-lg text-[var(--app-text)]">{item.storageLocation?.name || "-"}</p>
                </div>
                <div>
                  <p className="theme-muted mb-1 text-[18px] font-medium">Regal</p>
                  <p className="text-lg text-[var(--app-text)]">{item.storageArea || "-"}</p>
                </div>
                <div>
                  <p className="theme-muted mb-1 text-[18px] font-medium">Fach</p>
                  <p className="text-lg text-[var(--app-text)]">{item.bin || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

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
              <span className="text-4xl font-semibold">{item.stock}</span>
              <button type="button" className="rounded-lg border border-workshop-300 bg-[var(--app-surface)] p-2" onClick={() => quickStockAdjust(1)}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="theme-status-warning rounded-xl p-4 text-center">
            <p className="text-sm">Reserviert</p>
            <p className="mt-2 text-4xl font-semibold">{item.reservedQty}</p>
          </div>

          <div className="theme-status-success rounded-xl p-4 text-center">
            <p className="text-sm">Verfügbar</p>
            <p className="mt-2 text-4xl font-semibold">{item.availableStock}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="theme-muted text-lg">Mindestbestand: <b>{item.minStock ?? "-"}</b> Stück</p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <input className="input w-full sm:w-24" type="number" value={reservedQty} onChange={(e) => setReservedQty(Number(e.target.value))} />
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
                  <p className="theme-muted text-sm">{r.reservedQty}x • {new Date(r.createdAt).toLocaleDateString("de-DE")}</p>
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
            <input className="input w-full sm:w-28" type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
            <select className="input w-full sm:w-auto" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option>PURCHASE</option>
              <option>CONSUMPTION</option>
              <option>CORRECTION</option>
              <option>INVENTORY</option>
              <option>RESERVATION</option>
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
              Buchung erfassen
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

      <ItemBomSection
        itemId={item.id}
        bomChildren={item.bomChildren || []}
        bomParents={item.bomParents || []}
        editMode={editMode}
        onChanged={load}
      />

      <ItemAuditSection entries={item.auditEntries || []} />
    </div>
  );
}
