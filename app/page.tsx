"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

function fileHref(absolutePath: string) {
  const encoded = absolutePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/api/files/${encoded}`;
}

export default function HomePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkArea, setBulkArea] = useState("");
  const [bulkType, setBulkType] = useState("");
  const [areas, setAreas] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [types, setTypes] = useState<Array<{ id: string; areaId: string; code: string; name: string }>>([]);
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/items?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setItems(Array.isArray(data) ? data : data.items || []);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    load();
    fetch("/api/meta")
      .then((r) => r.json())
      .then((m) => {
        setAreas(m.areas || []);
        setTypes(m.types || []);
      });
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2">
        <input
          className="input max-w-sm"
          placeholder="Suchen: labelCode, Name, MPN, Hersteller"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn" onClick={load}>
          Suchen
        </button>
        <a className="btn-secondary" href="/api/export/csv">
          CSV Export
        </a>
        <a className="btn-secondary" href="/api/export/json">
          JSON Export
        </a>
        <a className="btn-secondary" href="/api/export/ptouch">
          P-touch CSV
        </a>
      </div>
      <div className="card flex flex-wrap items-center gap-2">
        <span className="text-sm">Bulk-Auswahl: {selected.length} Items</span>
        <select className="input w-40" value={bulkArea} onChange={(e) => setBulkArea(e.target.value)}>
          <option value="">Area</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code}
            </option>
          ))}
        </select>
        <select className="input w-48" value={bulkType} onChange={(e) => setBulkType(e.target.value)}>
          <option value="">Type</option>
          {types
            .filter((t) => !bulkArea || t.areaId === bulkArea)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} - {t.name}
              </option>
            ))}
        </select>
        <button
          className="btn-secondary"
          onClick={async () => {
            const res = await fetch("/api/items/bulk", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ itemIds: selected, areaId: bulkArea, typeId: bulkType, dryRun: true })
            });
            const data = await res.json();
            setBulkPreview(data.previewCodes || []);
          }}
        >
          Dry-run Codes
        </button>
        <button
          className="btn"
          onClick={async () => {
            await fetch("/api/items/bulk", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ itemIds: selected, areaId: bulkArea, typeId: bulkType, dryRun: false })
            });
            setSelected([]);
            setBulkPreview([]);
            await load();
          }}
        >
          Anwenden
        </button>
      </div>
      {bulkPreview.length > 0 && (
        <div className="card text-sm">
          <p className="mb-2 font-semibold">Bulk-Code Preview</p>
          <ul className="space-y-1">
            {bulkPreview.slice(0, 20).map((p) => (
              <li key={p.itemId} className="font-mono">
                {p.oldCode} -&gt; {p.newCode}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-auto">
        {loading ? (
          <p>Lade...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-workshop-200 text-left">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Bild</th>
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Kategorie</th>
                <th className="px-2 py-2">Ort</th>
                <th className="px-2 py-2">Bestand</th>
                <th className="px-2 py-2">Verfuegbar</th>
                <th className="px-2 py-2">Quick</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-workshop-100">
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...new Set([...prev, item.id])] : prev.filter((id) => id !== item.id)
                        )
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    {item.primaryImage ? (
                      <img
                        src={fileHref(item.primaryImage.thumbPath || item.primaryImage.path)}
                        alt={item.primaryImage.caption || item.name}
                        className="h-12 w-12 rounded border border-workshop-200 object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded border border-dashed border-workshop-200" />
                    )}
                  </td>
                  <td className="px-2 py-2 font-mono">
                    <Link href={`/items/${item.id}`} className="text-workshop-700 underline">
                      {item.labelCode}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{item.name}</td>
                  <td className="px-2 py-2">{item.category.name}</td>
                  <td className="px-2 py-2">{item.storageLocation.name}</td>
                  <td className={`px-2 py-2 ${item.minStock && item.stock <= item.minStock ? "text-red-700" : ""}`}>{item.stock}</td>
                  <td className="px-2 py-2">{item.availableStock}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      {[-5, -1, 1, 5].map((delta) => (
                        <button
                          key={delta}
                          className="btn-secondary px-2 py-1"
                          onClick={async () => {
                            await fetch(`/api/items/${item.id}/movements`, {
                              method: "POST",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({
                                delta,
                                reason: delta < 0 ? "CONSUMPTION" : "PURCHASE",
                                note: "Quick Button"
                              })
                            });
                            await load();
                          }}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
