"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";
import { translateApiErrorMessage } from "@/lib/app-language";
import { fileHref } from "@/lib/file-href";
import { TRASH_RETENTION_DAYS } from "@/lib/trash-policy";

type Item = {
  id: string;
  labelCode: string;
  name: string;
  updatedAt: string;
  category: { name: string };
  storageLocation: { name: string };
  primaryImage: {
    path: string;
    thumbPath: string | null;
    caption: string | null;
  } | null;
};

export default function ArchivePage() {
  const { language } = useAppLanguage();
  const locale = language === "en" ? "en-US" : "de-DE";
  const tr = (de: string, en: string) => (language === "en" ? en : de);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [working, setWorking] = useState<"restore" | "trash" | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/items?archived=1&sort=updatedAt", { cache: "no-store" });
    const data = await res.json();
    setItems(Array.isArray(data) ? data : data.items || []);
    setLoading(false);
  }, []);

  function toggleSelected(itemId: string, checked: boolean) {
    setSelected((prev) => {
      if (checked) return prev.includes(itemId) ? prev : [...prev, itemId];
      return prev.filter((id) => id !== itemId);
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelected(checked ? items.map((item) => item.id) : []);
  }

  async function applyArchiveAction(action: "restore" | "trash") {
    if (!selected.length) {
      setFeedback(tr("Bitte zuerst mindestens ein Item auswaehlen.", "Please select at least one item first."));
      return;
    }

    setWorking(action);
    setFeedback("");

    const res = await fetch("/api/items/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        itemIds: selected,
        ...(action === "restore" ? { unarchiveItems: true } : { deleteItems: true })
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setFeedback(translateApiErrorMessage(language, data?.error) || tr("Die Aktion konnte nicht ausgefuehrt werden.", "The action could not be completed."));
      setWorking("");
      return;
    }

    setSelected([]);
    setWorking("");
    await load();
  }

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const visibleIds = new Set(items.map((item) => item.id));
    setSelected((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [items]);

  const selectedSet = new Set(selected);
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedSet.has(item.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{tr("Archiv", "Archive")}</h1>
        <p className="text-sm text-workshop-700">{tr(`Geparkte Items bleiben erhalten, erscheinen aber nicht in den aktiven Listen. Beim Loeschen landen sie fuer ${TRASH_RETENTION_DAYS} Tage im Papierkorb.`, `Archived items stay preserved but no longer appear in active lists. When deleted, they move to trash for ${TRASH_RETENTION_DAYS} days.`)}</p>
      </div>

      {selected.length > 0 && (
        <div className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="whitespace-nowrap text-sm font-medium">
              {selected.length} {tr("ausgewaehlt", "selected")}
            </span>
            {!allVisibleSelected && items.length > 1 && (
              <button className="btn-secondary h-8 shrink-0 px-2.5 py-1 text-sm" onClick={() => toggleAllVisible(true)}>
                {tr("Alle sichtbar", "Select visible")}
              </button>
            )}
            <button className="btn h-8 shrink-0 px-2.5 py-1 text-sm" onClick={() => applyArchiveAction("restore")} disabled={working !== ""}>
              {working === "restore" ? tr("Stellt wieder her...", "Restoring...") : tr("Wiederherstellen", "Restore")}
            </button>
            <button
              className="theme-status-danger h-8 shrink-0 rounded-lg border border-transparent px-2.5 py-1 text-sm font-medium"
              onClick={() => applyArchiveAction("trash")}
              disabled={working !== ""}
            >
              {working === "trash" ? tr("Verschiebt...", "Moving...") : tr("In Papierkorb", "Move to trash")}
            </button>
            <button className="btn-secondary h-8 shrink-0 px-2.5 py-1 text-sm" onClick={() => setSelected([])}>
              {tr("Abwaehlen", "Clear selection")}
            </button>
          </div>
          {feedback && <p className="mt-2 text-sm text-red-700">{feedback}</p>}
        </div>
      )}

      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="card">
            <p>{tr("Lade...", "Loading...")}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="card">
            <p className="text-sm text-workshop-700">{tr("Keine archivierten Items vorhanden.", "No archived items found.")}</p>
          </div>
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <input
                  className="shrink-0"
                  type="checkbox"
                  checked={selectedSet.has(item.id)}
                  onChange={(e) => toggleSelected(item.id, e.target.checked)}
                />
                {item.primaryImage ? (
                  <Image
                    src={fileHref(item.primaryImage.thumbPath || item.primaryImage.path)}
                    alt={item.primaryImage.caption || item.name}
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 shrink-0 rounded border border-workshop-200 object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded border border-dashed border-workshop-200" />
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/items/${item.id}`} className="block truncate font-mono text-xs text-workshop-700 underline">
                    {item.labelCode}
                  </Link>
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-xs text-workshop-700">
                    {item.category.name} · {item.storageLocation.name}
                  </p>
                  <p className="text-xs text-workshop-700">{tr("Zuletzt geaendert", "Last updated")} {new Date(item.updatedAt).toLocaleDateString(locale)}</p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="hidden md:block">
        {loading ? (
          <div className="card">
            <p>{tr("Lade...", "Loading...")}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="card">
            <p className="text-sm text-workshop-700">{tr("Keine archivierten Items vorhanden.", "No archived items found.")}</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-workshop-200 text-left">
                  <th className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                      aria-label={tr("Alle sichtbaren Archiv-Items auswaehlen", "Select all visible archived items")}
                    />
                  </th>
                  <th className="px-2 py-2">{tr("Bild", "Image")}</th>
                  <th className="px-2 py-2">{tr("Code", "Code")}</th>
                  <th className="px-2 py-2">{tr("Name", "Name")}</th>
                  <th className="px-2 py-2">{tr("Kategorie", "Category")}</th>
                  <th className="px-2 py-2">{tr("Ort", "Location")}</th>
                  <th className="px-2 py-2">{tr("Stand", "Updated")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-workshop-100">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(item.id)}
                        onChange={(e) => toggleSelected(item.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      {item.primaryImage ? (
                        <Image
                          src={fileHref(item.primaryImage.thumbPath || item.primaryImage.path)}
                          alt={item.primaryImage.caption || item.name}
                          width={48}
                          height={48}
                          unoptimized
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
                    <td className="px-2 py-2">{new Date(item.updatedAt).toLocaleDateString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
