"use client";

import { useEffect, useMemo, useState } from "react";

export default function LocationsPage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/items')
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : d.items || []));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; low: number; bins: Array<{ code: string; name: string; stock: number }> }>();
    for (const item of items) {
      const key = item.storageLocation.name;
      if (!map.has(key)) map.set(key, { count: 0, low: 0, bins: [] });
      const row = map.get(key)!;
      row.count += 1;
      if (item.minStock && item.stock <= item.minStock) row.low += 1;
      row.bins.push({ code: item.labelCode, name: item.name, stock: item.stock });
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Wo liegt was?</h1>
      <a className="btn-secondary w-full sm:w-auto" href="/api/export/csv">Fachliste exportieren</a>
      <div className="grid gap-4 md:grid-cols-2">
        {grouped.map(([location, data]) => (
          <section key={location} className="card">
            <h2 className="text-lg font-semibold">{location}</h2>
            <p className="text-sm">Items: {data.count} | Unter Mindestbestand: <span className="font-semibold text-red-700">{data.low}</span></p>
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-sm">
              {data.bins.map((b) => (
                <li key={b.code} className="rounded border border-workshop-200 p-2">
                  <p className="font-mono">{b.code}</p>
                  <p className="break-words">{b.name}</p>
                  <p className="text-workshop-700">Bestand {b.stock}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
