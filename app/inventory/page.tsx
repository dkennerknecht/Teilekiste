"use client";

import { useEffect, useMemo, useState } from "react";

type Row = { id: string; labelCode: string; name: string; stock: number; storageArea: string | null; bin: string | null };

export default function InventoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [counted, setCounted] = useState<Record<string, number>>({});

  async function load() {
    const data = await fetch("/api/inventory").then((r) => r.json());
    setRows(data);
  }

  useEffect(() => {
    load();
  }, []);

  const preview = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, counted: counted[r.id], delta: typeof counted[r.id] === "number" ? counted[r.id] - r.stock : 0 }))
        .filter((r) => typeof r.counted === "number" && r.delta !== 0),
    [rows, counted]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Inventur-Modus</h1>
      <div className="card">
        <p className="mb-2 text-sm">Laufreihenfolge: Regal/Fach/Code</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-workshop-200 text-left">
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Ort</th>
              <th className="px-2 py-2">Soll</th>
              <th className="px-2 py-2">Ist</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-workshop-100">
                <td className="px-2 py-2 font-mono">{r.labelCode}</td>
                <td className="px-2 py-2">{r.name}</td>
                <td className="px-2 py-2">{r.storageArea || "-"} / {r.bin || "-"}</td>
                <td className="px-2 py-2">{r.stock}</td>
                <td className="px-2 py-2">
                  <input
                    className="input"
                    type="number"
                    defaultValue={r.stock}
                    onChange={(e) => setCounted((v) => ({ ...v, [r.id]: Number(e.target.value) }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card space-y-2">
        <h2 className="font-semibold">Differenz-Preview ({preview.length})</h2>
        <ul className="max-h-48 space-y-1 overflow-auto text-sm">
          {preview.map((p) => (
            <li key={p.id} className="rounded border border-workshop-200 p-2 font-mono">
              {p.labelCode}: Soll {p.stock}, Ist {p.counted}, Delta {p.delta > 0 ? `+${p.delta}` : p.delta}
            </li>
          ))}
        </ul>
        <button
          className="btn"
          onClick={async () => {
            const updates = preview.map((p) => ({ itemId: p.id, countedStock: p.counted!, note: "Inventur" }));
            const res = await fetch("/api/inventory", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ updates })
            });
            if (res.ok) {
              alert("Inventur uebernommen");
              load();
            }
          }}
        >
          Differenzen uebernehmen
        </button>
        <a className="btn-secondary" href="/api/export/csv">Inventur-Report CSV</a>
      </div>
    </div>
  );
}
