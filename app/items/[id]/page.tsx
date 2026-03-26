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

type TagOption = { id: string; name: string };
type CategoryOption = { id: string; name: string };
type AreaOption = { id: string; code: string; name: string };
type TypeOption = { id: string; areaId: string; code: string; name: string };

export default function ItemDetailPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [types, setTypes] = useState<TypeOption[]>([]);
  const [labelCfg, setLabelCfg] = useState({ separator: "-", digits: 3 });
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState("PURCHASE");
  const [note, setNote] = useState("");
  const [reservedQty, setReservedQty] = useState(1);
  const [reservedFor, setReservedFor] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/items/${params.id}`, { cache: "no-store" });
    const data = await res.json();
    setItem(data);
    setForm({
      name: data.name || "",
      description: data.description || "",
      categoryId: data.categoryId || "",
      storageArea: data.storageArea || "",
      bin: data.bin || "",
      minStock: data.minStock ?? "",
      manufacturer: data.manufacturer || "",
      mpn: data.mpn || "",
      barcodeEan: data.barcodeEan || "",
      tagIds: (data.tags || []).map((t: any) => t.tagId),
      areaId: "",
      typeId: "",
      labelNumber: ""
    });
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
        setAreas(meta.areas || []);
        setTypes(meta.types || []);
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
    if (!editMode || !item || !areas.length || !types.length) return;
    if (form.areaId && form.typeId) return;

    const parts = String(item.labelCode || "").split(labelCfg.separator);
    if (parts.length < 3) return;
    const areaCode = parts[parts.length - 3];
    const typeCode = parts[parts.length - 2];
    const numPart = parts[parts.length - 1];

    const area = areas.find((a) => a.code === areaCode);
    const type = types.find((t) => t.code === typeCode && (!area || t.areaId === area.id));
    setForm((prev: any) => ({
      ...prev,
      areaId: area?.id || prev.areaId,
      typeId: type?.id || prev.typeId,
      labelNumber: /^\\d+$/.test(numPart) ? numPart : prev.labelNumber
    }));
  }, [editMode, item, areas, types, labelCfg.separator, form?.areaId, form?.typeId]);

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

  return (
    <div className="space-y-4 text-[#171922] dark:text-[#e6ebf2]">
      <div className="rounded-xl border border-[#d7d7dc] bg-[#f4f4f6] px-3 py-3 sm:px-4 dark:border-[#2a313d] dark:bg-[#1a212d]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <button className="mt-0.5 text-[#33343b] dark:text-[#dce2ee]" onClick={() => window.history.back()}>
              <ArrowLeft size={22} />
            </button>
            <div>
              <p className="text-sm text-[#6a6d79] dark:text-[#a6b0c2]">Inventar / {item.category?.name || "Item"}</p>
              <h1 className="text-xl font-semibold leading-6 text-[#15161a] dark:text-[#e6ebf2]">{editMode ? "Item bearbeiten" : "Item Details"}</h1>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {editMode ? (
              <>
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#bfc2cc] bg-white px-4 py-2 text-sm font-medium text-[#22242b] sm:w-auto dark:border-[#3a4458] dark:bg-[#202837] dark:text-[#e6ebf2]"
                  onClick={() => {
                    setEditMode(false);
                    setForm({
                      name: item.name || "",
                      description: item.description || "",
                      categoryId: item.categoryId || "",
                      storageArea: item.storageArea || "",
                      bin: item.bin || "",
                      minStock: item.minStock ?? "",
                      manufacturer: item.manufacturer || "",
                      mpn: item.mpn || "",
                      barcodeEan: item.barcodeEan || "",
                      tagIds: (item.tags || []).map((t: any) => t.tagId),
                      areaId: "",
                      typeId: "",
                      labelNumber: ""
                    });
                  }}
                >
                  <X size={16} /> Abbrechen
                </button>
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#05082b] px-4 py-2 text-sm font-medium text-white sm:w-auto"
                  onClick={async () => {
                    const selectedArea = areas.find((a) => a.id === form.areaId);
                    const selectedType = types.find((t) => t.id === form.typeId);
                    const nextLabelCode =
                      selectedArea && selectedType && String(form.labelNumber || "").trim()
                        ? `${selectedArea.code}${labelCfg.separator}${selectedType.code}${labelCfg.separator}${String(form.labelNumber).padStart(labelCfg.digits, "0")}`
                        : undefined;
                    const payload = {
                      name: form.name,
                      description: form.description,
                      categoryId: form.categoryId,
                      storageArea: form.storageArea,
                      bin: form.bin,
                      manufacturer: form.manufacturer,
                      mpn: form.mpn,
                      barcodeEan: form.barcodeEan,
                      tagIds: form.tagIds,
                      minStock: form.minStock === "" ? null : Number(form.minStock),
                      ...(selectedArea && selectedType ? { areaId: selectedArea.id, typeId: selectedType.id } : {}),
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
                    }
                  }}
                >
                  <Save size={16} /> Speichern
                </button>
              </>
            ) : (
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#05082b] px-4 py-2 text-sm font-medium text-white sm:w-auto"
                onClick={() => setEditMode(true)}
              >
                <PencilLine size={16} /> Bearbeiten
              </button>
            )}
          </div>
        </div>
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
          <div className="grid grid-cols-1 gap-2 rounded-xl border border-[#d7d7dc] bg-[#f4f4f6] p-3 text-sm text-[#555869] sm:text-[16px] dark:border-[#2a313d] dark:bg-[#1a212d] dark:text-[#b4bdce] md:grid-cols-3">
            <div className="inline-flex items-center gap-2"><CalendarDays size={15} /> Erstellt: {new Date(item.createdAt).toLocaleDateString("de-DE")}</div>
            <div className="inline-flex items-center gap-2"><CalendarDays size={15} /> Zuletzt bearbeitet: {new Date(item.updatedAt).toLocaleDateString("de-DE")}</div>
            <div className="inline-flex items-center gap-2"><User size={15} /> von {owner}</div>
          </div>

          <div className="rounded-xl border border-[#d7d7dc] bg-white p-4 dark:border-[#2a313d] dark:bg-[#171d26]">
            <h2 className="mb-4 inline-flex items-center gap-2 text-[26px] font-semibold text-[#1b1d24] sm:text-[34px] dark:text-[#e6ebf2]"><FolderOpen size={18} /> Details</h2>

            <div className="space-y-4 text-[#171922]">
              <div>
                <p className="mb-1 text-[18px] font-medium text-[#6d7080]">Name</p>
                {editMode ? (
                  <input className="input text-lg" value={form.name} onChange={(e) => setForm((v: any) => ({ ...v, name: e.target.value }))} />
                ) : (
                  <p className="text-xl">{item.name}</p>
                )}
              </div>

              <div>
                <p className="mb-1 text-[18px] font-medium text-[#6d7080]"># ID</p>
                {editMode ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 md:grid-cols-3">
                      <select
                        className="input"
                        value={form.areaId}
                        onChange={(e) => {
                          const nextAreaId = e.target.value;
                          setForm((v: any) => ({
                            ...v,
                            areaId: nextAreaId,
                            typeId: types.find((t) => t.areaId === nextAreaId)?.id || ""
                          }));
                        }}
                      >
                        <option value="">Area (Label)</option>
                        {areas.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </option>
                        ))}
                      </select>
                      <select className="input" value={form.typeId} onChange={(e) => setForm((v: any) => ({ ...v, typeId: e.target.value }))}>
                        <option value="">Type (Label)</option>
                        {types
                          .filter((t) => !form.areaId || t.areaId === form.areaId)
                          .map((t) => (
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
                    <p className="text-sm font-mono text-[#4a4d5c]">
                      Vorschau:{" "}
                      {(() => {
                        const selectedArea = areas.find((a) => a.id === form.areaId);
                        const selectedType = types.find((t) => t.id === form.typeId);
                        if (!selectedArea || !selectedType || !String(form.labelNumber || "").trim()) return item.labelCode;
                        return `${selectedArea.code}${labelCfg.separator}${selectedType.code}${labelCfg.separator}${String(form.labelNumber).padStart(labelCfg.digits, "0")}`;
                      })()}
                    </p>
                  </div>
                ) : (
                  <p className="text-xl font-mono">{item.labelCode}</p>
                )}
              </div>

              <div>
                <p className="mb-1 text-[18px] font-medium text-[#6d7080]">Beschreibung</p>
                {editMode ? (
                  <textarea className="input min-h-28" value={form.description} onChange={(e) => setForm((v: any) => ({ ...v, description: e.target.value }))} />
                ) : (
                  <div className="text-lg leading-8 text-[#2a2d36] dark:text-[#d7deeb]">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{item.description || "-"}</ReactMarkdown>
                  </div>
                )}
              </div>

              <div className="grid gap-4 border-t border-[#e6e6eb] pt-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 inline-flex items-center gap-2 text-[18px] font-medium text-[#6d7080]"><Layers size={15} /> Kategorie</p>
                  {editMode ? (
                    <select className="input" value={form.categoryId} onChange={(e) => setForm((v: any) => ({ ...v, categoryId: e.target.value }))}>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-lg font-medium">{item.category?.name || "-"}</p>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-[18px] font-medium text-[#6d7080]">Hersteller</p>
                  {editMode ? (
                    <input className="input" value={form.manufacturer} onChange={(e) => setForm((v: any) => ({ ...v, manufacturer: e.target.value }))} />
                  ) : (
                    <p className="text-lg font-medium">{item.manufacturer || "-"}</p>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-[18px] font-medium text-[#6d7080]">MPN</p>
                  {editMode ? (
                    <input className="input" value={form.mpn} onChange={(e) => setForm((v: any) => ({ ...v, mpn: e.target.value }))} />
                  ) : (
                    <p className="text-lg font-mono">{item.mpn || "-"}</p>
                  )}
                </div>

                <div>
                  <p className="mb-1 inline-flex items-center gap-2 text-[18px] font-medium text-[#6d7080]"><Barcode size={15} /> EAN</p>
                  {editMode ? (
                    <input className="input" value={form.barcodeEan} onChange={(e) => setForm((v: any) => ({ ...v, barcodeEan: e.target.value }))} />
                  ) : (
                    <p className="text-lg font-mono">{item.barcodeEan || "-"}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 border-t border-[#e6e6eb] pt-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-[18px] font-medium text-[#6d7080]">Regal / Bereich</p>
                  {editMode ? (
                    <input className="input" value={form.storageArea} onChange={(e) => setForm((v: any) => ({ ...v, storageArea: e.target.value }))} />
                  ) : (
                    <p className="text-lg">{item.storageArea || "-"}</p>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-[18px] font-medium text-[#6d7080]">Fach / Bin</p>
                  {editMode ? (
                    <input className="input" value={form.bin} onChange={(e) => setForm((v: any) => ({ ...v, bin: e.target.value }))} />
                  ) : (
                    <p className="text-lg">{item.bin || "-"}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-[#e6e6eb] pt-4">
                <p className="mb-2 inline-flex items-center gap-2 text-[18px] font-medium text-[#6d7080]"><Tag size={15} /> Tags</p>
                {editMode ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          className={`rounded-full border px-3 py-1 text-sm ${
                            form.tagIds.includes(tag.id)
                              ? "border-[#0f1535] bg-[#0f1535] text-white"
                              : "border-[#d0d3dc] bg-white text-[#2f3240]"
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
                        <span key={t.tag.id} className="rounded-full border border-[#d0d3dc] bg-[#f3f4f8] px-3 py-1 text-sm font-medium">
                          {t.tag.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[#6d7080]">Keine Tags</span>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-4 border-t border-[#e6e6eb] pt-4 md:grid-cols-3">
                <div>
                  <p className="mb-1 inline-flex items-center gap-2 text-[18px] font-medium text-[#6d7080]"><MapPin size={15} /> Ort</p>
                  <p className="text-lg">{item.storageLocation?.name || "-"}</p>
                </div>
                <div>
                  <p className="mb-1 text-[18px] font-medium text-[#6d7080]">Regal</p>
                  <p className="text-lg">{item.storageArea || "-"}</p>
                </div>
                <div>
                  <p className="mb-1 text-[18px] font-medium text-[#6d7080]">Fach</p>
                  <p className="text-lg">{item.bin || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[#d7d7dc] bg-white p-4 dark:border-[#2a313d] dark:bg-[#171d26]">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="inline-flex items-center gap-2 text-2xl font-semibold text-[#1b1d24] dark:text-[#e6ebf2]"><Package2 size={18} /> Bestandsverwaltung</h3>
          <span className="rounded-full bg-[#d4eee1] px-3 py-1 text-sm font-medium text-[#0a7a4d]">Auf Lager</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#f2f2f5] p-4 text-center dark:bg-[#202734]">
            <p className="text-sm text-[#6d7080] dark:text-[#aab4c7]">Gesamtbestand</p>
            <div className="mt-2 flex items-center justify-center gap-3">
              <button type="button" className="rounded-lg border border-[#d0d3dc] bg-white p-2 dark:border-[#3a4458] dark:bg-[#121824]" onClick={() => quickStockAdjust(-1)}>
                <Minus size={14} />
              </button>
              <span className="text-4xl font-semibold">{item.stock}</span>
              <button type="button" className="rounded-lg border border-[#d0d3dc] bg-white p-2 dark:border-[#3a4458] dark:bg-[#121824]" onClick={() => quickStockAdjust(1)}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-[#f2ecdd] p-4 text-center dark:bg-[#3a3020]">
            <p className="text-sm text-[#b05300]">Reserviert</p>
            <p className="mt-2 text-4xl font-semibold text-[#b05300]">{item.reservedQty}</p>
          </div>

          <div className="rounded-xl bg-[#dceee7] p-4 text-center dark:bg-[#1c3a33]">
            <p className="text-sm text-[#0a7a4d]">Verfügbar</p>
            <p className="mt-2 text-4xl font-semibold text-[#0a7a4d]">{item.availableStock}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg text-[#616474] dark:text-[#aab4c7]">Mindestbestand: <b>{item.minStock ?? "-"}</b> Stück</p>
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

        <div className="mt-4 border-t border-[#e6e6eb] pt-3">
          <p className="mb-2 text-lg font-medium text-[#616474] dark:text-[#aab4c7]">Aktive Reservierungen</p>
          <ul className="space-y-2">
            {(item.reservations || []).map((r: any) => (
              <li key={r.id} className="flex flex-col gap-3 rounded-xl border border-[#e6e6eb] p-3 sm:flex-row sm:items-center sm:justify-between dark:border-[#2f3746]">
                <div className="min-w-0">
                  <p className="font-medium">{r.reservedFor}</p>
                  <p className="text-sm text-[#616474] dark:text-[#aab4c7]">{r.reservedQty}x • {new Date(r.createdAt).toLocaleDateString("de-DE")}</p>
                </div>
                <button
                  type="button"
                  className="text-[#7c7f8f] hover:text-[#373b49] dark:text-[#aab4c7] dark:hover:text-[#e6ebf2]"
                  onClick={async () => {
                    await fetch(`/api/reservations/${r.id}`, { method: "DELETE" });
                    await load();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
            {item.reservations?.length === 0 && <li className="text-sm text-[#616474] dark:text-[#aab4c7]">Keine aktiven Reservierungen</li>}
          </ul>
        </div>

        <div className="mt-4 border-t border-[#e6e6eb] pt-3">
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

      <section className="rounded-xl border border-[#d7d7dc] bg-white p-4 dark:border-[#2a313d] dark:bg-[#171d26]">
        <h3 className="mb-3 text-lg font-semibold text-[#1b1d24] dark:text-[#e6ebf2]">Historie</h3>
        <ul className="space-y-1 text-sm">
          {history.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-[#e6e6eb] p-2">
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
