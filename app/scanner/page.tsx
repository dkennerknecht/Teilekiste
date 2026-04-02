"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppLanguage } from "@/components/app-language-provider";
import { formatDisplayQuantity, getUnitDisplayLabel } from "@/lib/quantity";

export default function ScannerPage() {
  const router = useRouter();
  const { language } = useAppLanguage();
  const tr = (de: string, en: string) => (language === "en" ? en : de);
  const [code, setCode] = useState("");
  const [item, setItem] = useState<any>(null);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function scan(e?: FormEvent) {
    e?.preventDefault();
    const val = code.trim();
    if (!val) return;
    const drawerRes = await fetch(`/api/bins/${encodeURIComponent(val)}`);
    if (drawerRes.ok) {
      const drawer = await drawerRes.json();
      router.push(`/bins/${encodeURIComponent(drawer.fullCode || drawer.code || val.toUpperCase())}`);
      return;
    }
    const shelfRes = await fetch(`/api/shelves/${encodeURIComponent(val)}`);
    if (shelfRes.ok) {
      const shelf = await shelfRes.json();
      router.push(`/shelves/${encodeURIComponent(shelf.displayCode || shelf.code || val.toUpperCase())}`);
      return;
    }
    if (drawerRes.status === 403 || shelfRes.status === 403) {
      setItem(null);
      setMessage(tr("Kein Zugriff auf diese Position", "No access to this storage position"));
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
    const data = await res.json();
    const exact = (data || []).find((row: any) => row.labelCode === val) || data?.[0] || null;
    if (!exact) {
      setItem(null);
      setMessage(tr("Kein Treffer", "No result"));
      return;
    }
    const detail = await fetch(`/api/items/${exact.id}`).then((r) => r.json());
    if (detail?.redirectToItemId) {
      const redirectedDetail = await fetch(`/api/items/${detail.redirectToItemId}`).then((r) => r.json());
      setItem(redirectedDetail);
      setMessage("");
      return;
    }
    setItem(detail);
    setMessage("");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{tr("Scanner-Modus", "Scanner Mode")}</h1>
      <form className="card flex flex-col gap-2 sm:flex-row" onSubmit={scan}>
        <input
          ref={inputRef}
          autoFocus
          className="input font-mono"
          placeholder={tr("Code scannen oder eingeben (z.B. EL-KB-023)", "Scan or enter code (e.g. EL-KB-023)")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn w-full sm:w-auto" type="submit">
          {tr("Oeffnen", "Open")}
        </button>
      </form>
      {message && <p className="text-sm text-red-700">{message}</p>}
      {item && (
        <div className="card space-y-2">
          <p className="font-mono text-workshop-700">{item.labelCode}</p>
          <h2 className="text-xl font-semibold">{item.name}</h2>
          {item.displayPosition && (
            <p className="font-mono text-sm text-workshop-700">
              {tr("Position", "Position")}: {item.displayPosition}
            </p>
          )}
          <p>{tr("Bestand", "Stock")}: {formatDisplayQuantity(item.unit, item.stock)} | {tr("Verfuegbar", "Available")}: {formatDisplayQuantity(item.unit, item.availableStock)}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="btn w-full sm:w-auto"
              onClick={async () => {
                await fetch(`/api/items/${item.id}/movements`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ delta: -1, reason: "CONSUMPTION", note: "Scanner -1" })
                });
                await scan();
              }}
            >
              -1 {getUnitDisplayLabel(item.unit)} {tr("buchen", "book")}
            </button>
            <Link className="btn-secondary w-full sm:w-auto" href={`/items/${item.id}`}>
              {tr("Detailseite", "Details")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
