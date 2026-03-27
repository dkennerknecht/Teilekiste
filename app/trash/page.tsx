"use client";

import { useCallback, useEffect, useState } from "react";
import { TRASH_RETENTION_DAYS, getTrashDaysRemaining, getTrashExpiryDate } from "@/lib/trash-policy";

export default function TrashPage() {
  const [items, setItems] = useState<any[]>([]);
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/trash");
    const data = await res.json().catch(() => []);
    setItems(Array.isArray(data) ? data : []);
  }, []);

  async function restoreItem(itemId: string) {
    setFeedback("");
    const res = await fetch("/api/trash", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setFeedback(data?.error || "Wiederherstellen fehlgeschlagen.");
      return;
    }
    await load();
  }

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Papierkorb</h1>
        <p className="text-sm text-workshop-700">
          Geloeschte Items bleiben {TRASH_RETENTION_DAYS} Tage im Papierkorb und koennen in dieser Zeit wiederhergestellt werden.
        </p>
      </div>
      {feedback && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{feedback}</div>}
      <div className="space-y-3 md:hidden">
        {items.length === 0 ? (
          <div className="card">
            <p className="text-sm text-workshop-700">Keine geloeschten Items im Papierkorb.</p>
          </div>
        ) : (
          items.map((item) => {
            const expiresAt = getTrashExpiryDate(item.deletedAt);
            const daysRemaining = getTrashDaysRemaining(item.deletedAt);
            return (
              <div key={item.id} className="card space-y-3">
                <div>
                  <p className="font-mono text-sm text-workshop-700">{item.labelCode}</p>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-workshop-700">Geloescht am {new Date(item.deletedAt).toLocaleString("de-DE")}</p>
                  <p className="text-sm text-workshop-700">Loescht sich am {expiresAt.toLocaleString("de-DE")}</p>
                  <p className="text-sm text-workshop-700">Noch {daysRemaining} {daysRemaining === 1 ? "Tag" : "Tage"}</p>
                </div>
                <div className="grid gap-2">
                  <button className="btn-secondary w-full" onClick={() => restoreItem(item.id)}>
                    Wiederherstellen
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="card hidden overflow-x-auto md:block">
        <table className="min-w-[720px] w-full text-sm">
          <thead>
            <tr className="border-b border-workshop-200 text-left">
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Geloescht am</th>
              <th className="px-2 py-2">Loescht sich am</th>
              <th className="px-2 py-2">Restzeit</th>
              <th className="px-2 py-2">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-2 py-4 text-workshop-700" colSpan={6}>
                  Keine geloeschten Items im Papierkorb.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const expiresAt = getTrashExpiryDate(item.deletedAt);
                const daysRemaining = getTrashDaysRemaining(item.deletedAt);
                return (
                  <tr key={item.id} className="border-b border-workshop-100">
                    <td className="px-2 py-2 font-mono">{item.labelCode}</td>
                    <td className="px-2 py-2">{item.name}</td>
                    <td className="px-2 py-2">{new Date(item.deletedAt).toLocaleString("de-DE")}</td>
                    <td className="px-2 py-2">{expiresAt.toLocaleString("de-DE")}</td>
                    <td className="px-2 py-2">{daysRemaining} {daysRemaining === 1 ? "Tag" : "Tage"}</td>
                    <td className="px-2 py-2">
                      <button className="btn-secondary" onClick={() => restoreItem(item.id)}>
                        Wiederherstellen
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
