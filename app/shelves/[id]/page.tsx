"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";
import { translateApiErrorMessage } from "@/lib/app-language";
import { formatDisplayQuantity } from "@/lib/quantity";

export default function StorageShelfPage({ params }: { params: { id: string } }) {
  const { language } = useAppLanguage();
  const tr = useCallback((de: string, en: string) => (language === "en" ? en : de), [language]);
  const [shelf, setShelf] = useState<any>(null);
  const [error, setError] = useState("");

  const loadShelf = useCallback(async () => {
    try {
      const response = await fetch(`/api/shelves/${encodeURIComponent(params.id)}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(translateApiErrorMessage(language, data?.error) || tr("Bereich konnte nicht geladen werden", "Failed to load shelf"));
      }
      setShelf(data);
      setError("");
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  }, [language, params.id, tr]);

  useEffect(() => {
    loadShelf();
  }, [loadShelf]);

  if (error) {
    return <div className="card text-sm text-red-700">{error}</div>;
  }
  if (!shelf) {
    return <p>{tr("Lade...", "Loading...")}</p>;
  }

  const isOpenArea = shelf.mode === "OPEN_AREA";

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="font-mono text-workshop-700">{shelf.code || shelf.name}</p>
        <h1 className="text-2xl font-semibold">{isOpenArea ? tr("Bereich", "Shelf area") : tr("Drawer-Regal", "Drawer shelf")}</h1>
        <p className="text-sm text-workshop-700">
          {[shelf.storageLocation?.name || null, shelf.name || null].filter(Boolean).join(" / ") || "-"}
        </p>
        {shelf.description ? <p className="mt-2 text-sm text-workshop-700">{shelf.description}</p> : null}
      </div>

      {isOpenArea ? (
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{tr("Zugewiesene Items", "Assigned items")}</h2>
            <Link className="btn-secondary" href="/scanner">
              {tr("Zur Scanner-Seite", "Back to scanner")}
            </Link>
          </div>
          <div className="space-y-3">
            {shelf.items.length === 0 ? (
              <p className="text-sm text-workshop-700">{tr("Keine Items in diesem Bereich.", "No items in this shelf area.")}</p>
            ) : (
              shelf.items.map((item: any) => (
                <div key={item.id} className="rounded-xl border border-workshop-200 p-3">
                  <Link className="font-medium hover:underline" href={`/items/${item.id}`}>
                    {item.name}
                  </Link>
                  <p className="text-sm text-workshop-700">{item.labelCode}</p>
                  <p className="text-sm">
                    {tr("Bestand", "Stock")}: {formatDisplayQuantity(item.unit, item.stock)} · {tr("Verfuegbar", "Available")}:{" "}
                    {formatDisplayQuantity(item.unit, item.availableStock)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">{tr("Drawer in diesem Regal", "Drawers in this shelf")}</h2>
          <div className="space-y-3">
            {shelf.bins.length === 0 ? (
              <p className="text-sm text-workshop-700">{tr("Noch keine Drawer angelegt.", "No drawers created yet.")}</p>
            ) : (
              shelf.bins.map((bin: any) => (
                <div key={bin.id} className="rounded-xl border border-workshop-200 p-3">
                  <Link className="font-medium hover:underline" href={`/bins/${bin.id}`}>
                    {bin.code}
                  </Link>
                  <p className="text-sm text-workshop-700">
                    {tr("Slots", "Slots")}: {bin.slotCount} · {tr("Belegt", "Occupied")}: {bin._count?.items || 0}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
