"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";
import { TRASH_RETENTION_DAYS, getTrashDaysRemaining, getTrashExpiryDate } from "@/lib/trash-policy";

export default function TrashPage() {
  const { language } = useAppLanguage();
  const locale = language === "en" ? "en-US" : "de-DE";
  const tr = (de: string, en: string) => (language === "en" ? en : de);
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
      setFeedback(data?.error || tr("Wiederherstellen fehlgeschlagen.", "Restore failed."));
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
        <h1 className="text-2xl font-semibold">{tr("Papierkorb", "Trash")}</h1>
        <p className="text-sm text-workshop-700">
          {tr(`Geloeschte Items bleiben ${TRASH_RETENTION_DAYS} Tage im Papierkorb und koennen in dieser Zeit wiederhergestellt werden.`, `Deleted items stay in trash for ${TRASH_RETENTION_DAYS} days and can be restored during that time.`)}
        </p>
      </div>
      {feedback && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{feedback}</div>}
      <div className="space-y-3 md:hidden">
        {items.length === 0 ? (
          <div className="card">
            <p className="text-sm text-workshop-700">{tr("Keine geloeschten Items im Papierkorb.", "No deleted items in trash.")}</p>
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
                  <p className="text-sm text-workshop-700">{tr("Geloescht am", "Deleted at")} {new Date(item.deletedAt).toLocaleString(locale)}</p>
                  <p className="text-sm text-workshop-700">{tr("Loescht sich am", "Auto-deletes at")} {expiresAt.toLocaleString(locale)}</p>
                  <p className="text-sm text-workshop-700">{tr("Noch", "Remaining")} {daysRemaining} {daysRemaining === 1 ? tr("Tag", "day") : tr("Tage", "days")}</p>
                </div>
                <div className="grid gap-2">
                  <button className="btn-secondary w-full" onClick={() => restoreItem(item.id)}>
                    {tr("Wiederherstellen", "Restore")}
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
              <th className="px-2 py-2">{tr("Name", "Name")}</th>
              <th className="px-2 py-2">{tr("Geloescht am", "Deleted at")}</th>
              <th className="px-2 py-2">{tr("Loescht sich am", "Auto-deletes at")}</th>
              <th className="px-2 py-2">{tr("Restzeit", "Time left")}</th>
              <th className="px-2 py-2">{tr("Aktion", "Action")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-2 py-4 text-workshop-700" colSpan={6}>
                  {tr("Keine geloeschten Items im Papierkorb.", "No deleted items in trash.")}
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
                    <td className="px-2 py-2">{new Date(item.deletedAt).toLocaleString(locale)}</td>
                    <td className="px-2 py-2">{expiresAt.toLocaleString(locale)}</td>
                    <td className="px-2 py-2">{daysRemaining} {daysRemaining === 1 ? tr("Tag", "day") : tr("Tage", "days")}</td>
                    <td className="px-2 py-2">
                      <button className="btn-secondary" onClick={() => restoreItem(item.id)}>
                        {tr("Wiederherstellen", "Restore")}
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
