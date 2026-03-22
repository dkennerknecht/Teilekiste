"use client";

import { useEffect, useState } from "react";

export default function TrashPage() {
  const [items, setItems] = useState<any[]>([]);

  async function load() {
    setItems(await fetch('/api/trash').then((r) => r.json()));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Papierkorb</h1>
      <div className="card overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-workshop-200 text-left">
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Geloescht am</th>
              <th className="px-2 py-2">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-workshop-100">
                <td className="px-2 py-2 font-mono">{item.labelCode}</td>
                <td className="px-2 py-2">{item.name}</td>
                <td className="px-2 py-2">{new Date(item.deletedAt).toLocaleString('de-DE')}</td>
                <td className="px-2 py-2">
                  <div className="flex gap-2">
                    <button className="btn-secondary" onClick={async () => { await fetch('/api/trash', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemId: item.id }) }); load(); }}>Wiederherstellen</button>
                    <button className="btn" onClick={async () => { await fetch('/api/trash', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemId: item.id }) }); load(); }}>Endgueltig loeschen</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
