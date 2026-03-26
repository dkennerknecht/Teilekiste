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
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <div key={r.id} className="card space-y-2">
            <div>
              <p className="font-mono text-sm text-workshop-700">{r.labelCode}</p>
              <p className="font-medium">{r.name}</p>
              <p className="text-sm text-workshop-700">
                {r.storageArea || "-"} / {r.bin || "-"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-workshop-50 p-3">
                <p className="text-workshop-700">Soll</p>
                <p className="mt-1 text-lg font-semibold">{r.stock}</p>
              </div>
              <label className="rounded-lg bg-workshop-50 p-3">
                <span className="text-workshop-700">Ist</span>
                <input
                  className="input mt-2"
                  type="number"
                  defaultValue={r.stock}
                  onChange={(e) => setCounted((v) => ({ ...v, [r.id]: Number(e.target.value) }))}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="card hidden md:block">
        <p className="mb-2 text-sm">Laufreihenfolge: Regal/Fach/Code</p>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
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
          className="btn w-full sm:w-auto"
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
        <a className="btn-secondary w-full sm:w-auto" href="/api/export/csv">Inventur-Report CSV</a>
      </div>
    </div>
  );
}
