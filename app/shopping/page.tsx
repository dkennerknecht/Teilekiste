"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";
import { formatDisplayQuantity } from "@/lib/quantity";

export default function ShoppingPage() {
  const [items, setItems] = useState<any[]>([]);
  const { t } = useAppLanguage();

  useEffect(() => {
    fetch("/api/shopping-list")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []));
  }, []);

  useEffect(() => {
    document.title = `${t("shoppingPageTitle")} - Teilekiste Inventory`;
  }, [t]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("shoppingTitle")}</h1>
      <a className="btn-secondary w-full sm:w-auto" href="/api/export/csv?lowStock=1">
        {t("navCsvExport")}
      </a>
      <div className="space-y-3 md:hidden">
        {items.map((item) => (
          <div key={item.id} className="card space-y-2">
            <div>
              <p className="font-mono text-sm text-workshop-700">{item.labelCode}</p>
              <Link className="font-medium hover:underline" href={`/items/${item.id}`} aria-label={`${t("shoppingOpenItem")}: ${item.name}`}>
                {item.name}
              </Link>
              <p className="text-sm text-workshop-700">{item.storageLocation}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-workshop-50 p-3">{t("shoppingAvailable")}: <b>{formatDisplayQuantity(item.unit, item.available)}</b></div>
              <div className="rounded-lg bg-workshop-50 p-3">{t("shoppingMinimum")}: <b>{formatDisplayQuantity(item.unit, item.minStock)}</b></div>
              <div className="rounded-lg bg-workshop-50 p-3 text-red-700">{t("shoppingNeeded")}: <b>{formatDisplayQuantity(item.unit, item.needed)}</b></div>
            </div>
            <Link className="btn-secondary w-full" href={`/items/${item.id}`}>
              {t("shoppingOpen")}
            </Link>
          </div>
        ))}
      </div>
      <div className="card hidden overflow-x-auto md:block">
        <table className="min-w-[760px] w-full text-sm">
          <thead>
            <tr className="border-b border-workshop-200 text-left">
              <th className="px-2 py-2">Code</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">{t("shoppingLocation")}</th>
              <th className="px-2 py-2">{t("shoppingAvailable")}</th>
              <th className="px-2 py-2">{t("shoppingMinimum")}</th>
              <th className="px-2 py-2">{t("shoppingNeeded")}</th>
              <th className="px-2 py-2">{t("shoppingOpen")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-workshop-100">
                <td className="px-2 py-2 font-mono">{item.labelCode}</td>
                <td className="px-2 py-2">
                  <Link className="hover:underline" href={`/items/${item.id}`} aria-label={`${t("shoppingOpenItem")}: ${item.name}`}>
                    {item.name}
                  </Link>
                </td>
                <td className="px-2 py-2">{item.storageLocation}</td>
                <td className="px-2 py-2">{formatDisplayQuantity(item.unit, item.available)}</td>
                <td className="px-2 py-2">{formatDisplayQuantity(item.unit, item.minStock)}</td>
                <td className="px-2 py-2 text-red-700">{formatDisplayQuantity(item.unit, item.needed)}</td>
                <td className="px-2 py-2">
                  <Link className="btn-secondary" href={`/items/${item.id}`}>
                    {t("shoppingOpen")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
