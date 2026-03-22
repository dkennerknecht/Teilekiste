"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string; code?: string; areaId?: string; codeLabel?: string };

export default function NewItemPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [areas, setAreas] = useState<Option[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [labelPreview, setLabelPreview] = useState("");
  const [duplicates, setDuplicates] = useState<Array<{ id: string; labelCode: string; name: string }>>([]);
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
    barcodeEan: "",
    areaId: "",
    typeId: "",
    tagIds: [] as string[]
  });

  useEffect(() => {
    const load = async () => {
      const { categories: cat, locations: loc, areas: ar, types: ty } = await fetch("/api/meta").then((r) => r.json());
      setCategories(cat);
      setLocations(loc);
      setAreas(ar);
      setTypes(ty);
      if (cat[0]) setForm((f) => ({ ...f, categoryId: cat[0].id }));
      if (loc[0]) setForm((f) => ({ ...f, storageLocationId: loc[0].id }));
      if (ar[0]) {
        setForm((f) => ({ ...f, areaId: ar[0].id }));
        const t = ty.find((x: Option) => x.areaId === ar[0].id);
        if (t) setForm((f) => ({ ...f, typeId: t.id }));
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!form.areaId || !form.typeId) return;
    fetch(`/api/label/preview?areaId=${form.areaId}&typeId=${form.typeId}`)
      .then((r) => r.json())
      .then((d) => setLabelPreview(d.preview || ""));
  }, [form.areaId, form.typeId]);

  useEffect(() => {
    if (!form.name && !form.mpn && !form.barcodeEan) return;
    fetch(
      `/api/items/duplicates?name=${encodeURIComponent(form.name)}&mpn=${encodeURIComponent(form.mpn)}&barcodeEan=${encodeURIComponent(form.barcodeEan)}`
    )
      .then((r) => r.json())
      .then(setDuplicates);
  }, [form.name, form.mpn, form.barcodeEan]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Neues Item</h1>
      <div className="card">
        <div className="mb-2 text-sm text-workshop-700">
          Code-Vorschau: <span className="font-mono">{labelPreview || "-"}</span>
        </div>
        {duplicates.length > 0 && (
          <div className="mb-3 rounded-md border border-yellow-500 bg-yellow-50 p-2 text-sm">
            Moegliche Duplikate: {duplicates.map((d) => `${d.labelCode} (${d.name})`).join(", ")}
          </div>
        )}
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
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
              router.push(`/items/${item.id}`);
            } else {
              alert("Anlegen fehlgeschlagen");
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
            />
          </label>

          <label className="text-sm">
            Hersteller
            <input className="input mt-1" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          </label>

          <label className="text-sm">
            MPN
            <input className="input mt-1" value={form.mpn} onChange={(e) => setForm({ ...form, mpn: e.target.value })} />
          </label>

          <label className="text-sm">
            EAN / Barcode
            <input className="input mt-1" value={form.barcodeEan} onChange={(e) => setForm({ ...form, barcodeEan: e.target.value })} />
          </label>

          <label className="text-sm">
            Kategorie
            <select className="input mt-1" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Lagerort
            <select className="input mt-1" value={form.storageLocationId} onChange={(e) => setForm({ ...form, storageLocationId: e.target.value })}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Area (Label)
            <select className="input mt-1" value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Type (Label)
            <select className="input mt-1" value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })}>
              {types
                .filter((t) => !form.areaId || t.areaId === form.areaId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} - {t.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm">
            Regal / Bereich
            <input className="input mt-1" value={form.storageArea} onChange={(e) => setForm({ ...form, storageArea: e.target.value })} />
          </label>

          <label className="text-sm">
            Fach / Bin
            <input className="input mt-1" value={form.bin} onChange={(e) => setForm({ ...form, bin: e.target.value })} />
          </label>

          <label className="text-sm">
            Bestand
            <input
              className="input mt-1"
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
            />
          </label>

          <label className="text-sm">
            Mindestbestand (optional)
            <input
              className="input mt-1"
              type="number"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              placeholder="leer = kein Mindestbestand"
            />
          </label>

          <label className="text-sm">
            Einheit
            <select className="input mt-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              <option value="STK">Stk</option>
              <option value="M">m</option>
              <option value="SET">Set</option>
              <option value="PACK">Pack</option>
            </select>
          </label>

          <label className="text-sm md:col-span-2">
            Beschreibung (Markdown)
            <textarea
              className="input mt-1 min-h-28"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <button className="btn md:col-span-2" type="submit">
            Speichern
          </button>
        </form>
      </div>
    </div>
  );
}
