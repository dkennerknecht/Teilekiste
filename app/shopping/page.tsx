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
      <a className="btn-secondary" href="/api/export/csv?lowStock=1">
        CSV Export
      </a>
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-workshop-200 text-left">
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Ort</th>
              <th className="px-2 py-2">Verfuegbar</th>
              <th className="px-2 py-2">Min</th>
              <th className="px-2 py-2">Bedarf</th>
              <th className="px-2 py-2">Ziel</th>
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
                <td className="px-2 py-2">{item.targetQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
