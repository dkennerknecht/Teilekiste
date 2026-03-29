"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { formatDisplayQuantity, getUnitDisplayLabel } from "@/lib/quantity";

export default function ScannerPage() {
  const [code, setCode] = useState("");
  const [item, setItem] = useState<any>(null);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function scan(e?: FormEvent) {
    e?.preventDefault();
    const val = code.trim();
    if (!val) return;
    const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
    const data = await res.json();
    const exact = (data || []).find((row: any) => row.labelCode === val) || data?.[0] || null;
    if (!exact) {
      setItem(null);
      setMessage("Kein Treffer");
      return;
    }
    const detail = await fetch(`/api/items/${exact.id}`).then((r) => r.json());
    setItem(detail);
    setMessage("");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Scanner-Mode</h1>
      <form className="card flex flex-col gap-2 sm:flex-row" onSubmit={scan}>
        <input
          ref={inputRef}
          autoFocus
          className="input font-mono"
          placeholder="Code scannen oder eingeben (z.B. EL-KB-023)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn w-full sm:w-auto" type="submit">
          Oeffnen
        </button>
      </form>
      {message && <p className="text-sm text-red-700">{message}</p>}
      {item && (
        <div className="card space-y-2">
          <p className="font-mono text-workshop-700">{item.labelCode}</p>
          <h2 className="text-xl font-semibold">{item.name}</h2>
          <p>Bestand: {formatDisplayQuantity(item.unit, item.stock)} | Verfuegbar: {formatDisplayQuantity(item.unit, item.availableStock)}</p>
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
              -1 {getUnitDisplayLabel(item.unit)} buchen
            </button>
            <Link className="btn-secondary w-full sm:w-auto" href={`/items/${item.id}`}>
              Detailseite
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
