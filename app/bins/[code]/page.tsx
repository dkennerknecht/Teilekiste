"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";
import { translateApiErrorMessage } from "@/lib/app-language";
import { formatDisplayQuantity } from "@/lib/quantity";

export default function StorageBinPage({ params }: { params: { code: string } }) {
  const { language } = useAppLanguage();
  const tr = useCallback((de: string, en: string) => (language === "en" ? en : de), [language]);
  const [drawer, setDrawer] = useState<any>(null);
  const [error, setError] = useState("");

  const loadDrawer = useCallback(async () => {
    try {
      const response = await fetch(`/api/bins/${encodeURIComponent(params.code)}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(translateApiErrorMessage(language, data?.error) || tr("Drawer konnte nicht geladen werden", "Failed to load drawer"));
      }
      setDrawer(data);
      setError("");
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  }, [language, params.code, tr]);

  useEffect(() => {
    loadDrawer();
  }, [loadDrawer]);

  if (error) {
    return <div className="card text-sm text-red-700">{error}</div>;
  }
  if (!drawer) {
    return <p>{tr("Lade...", "Loading...")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="font-mono text-workshop-700">{drawer.code}</p>
        <h1 className="text-2xl font-semibold">{tr("Drawer-Inhalt", "Drawer contents")}</h1>
        <p className="text-sm text-workshop-700">
          {[drawer.storageLocation?.name || null, drawer.storageArea || null].filter(Boolean).join(" / ") || "-"}
        </p>
        <p className="mt-2 text-sm text-workshop-700">
          {tr("Slots", "Slots")}: {drawer.slotCount} · {tr("Frei", "Free")}: {drawer.freeSlots.length}
        </p>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tr("Belegung", "Occupancy")}</h2>
          <Link className="btn-secondary" href="/scanner">
            {tr("Zur Scanner-Seite", "Back to scanner")}
          </Link>
        </div>

        <div className="space-y-3">
          {Array.from({ length: drawer.slotCount }, (_, index) => index + 1).map((slot) => {
            const item = drawer.items.find((entry: any) => entry.binSlot === slot);
            return (
              <div key={slot} className="rounded-xl border border-workshop-200 p-3">
                <p className="font-mono text-sm text-workshop-700">{drawer.code}-{slot}</p>
                {item ? (
                  <div className="mt-1 space-y-1">
                    <Link className="font-medium hover:underline" href={`/items/${item.id}`}>
                      {item.name}
                    </Link>
                    <p className="text-sm text-workshop-700">{item.labelCode}</p>
                    <p className="text-sm">
                      {tr("Bestand", "Stock")}: {formatDisplayQuantity(item.unit, item.stock)} · {tr("Verfuegbar", "Available")}:{" "}
                      {formatDisplayQuantity(item.unit, item.availableStock)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-workshop-700">{tr("Frei", "Free")}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
