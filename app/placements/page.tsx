"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";
import { formatDisplayQuantity } from "@/lib/quantity";

async function fetchPlacementItems(status: "UNPLACED" | "INCOMING") {
  const response = await fetch(`/api/items?placementStatus=${status}`, { cache: "no-store" });
  const data = await response.json();
  return Array.isArray(data) ? data : data.items || [];
}

export default function PlacementsPage() {
  const { language } = useAppLanguage();
  const tr = (de: string, en: string) => (language === "en" ? en : de);
  const [unplacedItems, setUnplacedItems] = useState<any[]>([]);
  const [incomingItems, setIncomingItems] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([fetchPlacementItems("UNPLACED"), fetchPlacementItems("INCOMING")]).then(([unplaced, incoming]) => {
      setUnplacedItems(unplaced);
      setIncomingItems(incoming);
    });
  }, [language]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{tr("Platzierung & Wareneingang", "Placement & incoming goods")}</h1>
        <p className="text-sm text-workshop-700">
          {tr(
            "Hier findest du physisch vorhandene, aber noch unplatzierte Items sowie erwartete Ware ohne fertigen Lagerplatz.",
            "This view lists physically present but unplaced items as well as expected goods without a finalized storage position."
          )}
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{tr("Braucht Lagerplatz", "Needs placement")}</h2>
        {unplacedItems.length === 0 ? (
          <p className="text-sm text-workshop-700">{tr("Keine unplatzierten Items.", "No unplaced items.")}</p>
        ) : (
          unplacedItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-workshop-200 p-3">
              <p className="font-mono text-sm text-workshop-700">{item.labelCode}</p>
              <Link className="font-medium hover:underline" href={`/items/${item.id}`}>
                {item.name}
              </Link>
              <p className="text-sm text-workshop-700">
                {tr("Bestand", "Stock")}: {formatDisplayQuantity(item.unit, item.stock)}
              </p>
            </div>
          ))
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{tr("Wareneingang / Erwartet", "Incoming / expected")}</h2>
        {incomingItems.length === 0 ? (
          <p className="text-sm text-workshop-700">{tr("Keine erwarteten Items.", "No expected items.")}</p>
        ) : (
          incomingItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-workshop-200 p-3">
              <p className="font-mono text-sm text-workshop-700">{item.labelCode}</p>
              <Link className="font-medium hover:underline" href={`/items/${item.id}`}>
                {item.name}
              </Link>
              <p className="text-sm text-workshop-700">
                {tr("Erwartet", "Incoming")}: {formatDisplayQuantity(item.unit, item.incomingQty)}
              </p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
