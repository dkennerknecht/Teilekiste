"use client";

import { useEffect, useState } from "react";

export default function ShoppingPage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/shopping-list")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Einkaufsliste (unter Mindestbestand)</h1>
      <a className="btn-secondary w-full sm:w-auto" href="/api/export/csv?lowStock=1">
        CSV Export
      </a>
      <div className="space-y-3 md:hidden">
        {items.map((item) => (
          <div key={item.id} className="card space-y-2">
            <div>
              <p className="font-mono text-sm text-workshop-700">{item.labelCode}</p>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-workshop-700">{item.storageLocation}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-workshop-50 p-3">Verfuegbar: <b>{item.available}</b></div>
              <div className="rounded-lg bg-workshop-50 p-3">Min: <b>{item.minStock}</b></div>
              <div className="rounded-lg bg-workshop-50 p-3 text-red-700">Bedarf: <b>{item.needed}</b></div>
            </div>
          </div>
        ))}
      </div>
      <div className="card hidden overflow-x-auto md:block">
        <table className="min-w-[680px] w-full text-sm">
          <thead>
            <tr className="border-b border-workshop-200 text-left">
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Ort</th>
              <th className="px-2 py-2">Verfuegbar</th>
              <th className="px-2 py-2">Min</th>
              <th className="px-2 py-2">Bedarf</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-workshop-100">
                <td className="px-2 py-2 font-mono">{item.labelCode}</td>
                <td className="px-2 py-2">{item.name}</td>
                <td className="px-2 py-2">{item.storageLocation}</td>
                <td className="px-2 py-2">{item.available}</td>
                <td className="px-2 py-2">{item.minStock}</td>
                <td className="px-2 py-2 text-red-700">{item.needed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
