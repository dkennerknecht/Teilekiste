"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAppLanguage } from "@/components/app-language-provider";

type BomChild = {
  childItemId: string;
  qty: number;
  child: {
    id: string;
    labelCode: string;
    name: string;
    stock: number;
    minStock: number | null;
    unit: string;
    storageLocation: { name: string };
  };
};

type BomParent = {
  parentItemId: string;
  qty: number;
  parent: {
    id: string;
    labelCode: string;
    name: string;
    stock: number;
    unit: string;
    storageLocation: { name: string };
  };
};

type SearchItem = {
  id: string;
  labelCode: string;
  name: string;
};

export function ItemBomSection(props: {
  itemId: string;
  bomChildren: BomChild[];
  bomParents: BomParent[];
  editMode: boolean;
  onChanged: () => Promise<void>;
}) {
  const { language } = useAppLanguage();
  const tr = (de: string, en: string) => (language === "en" ? en : de);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, number>>({});
  const [newQty, setNewQty] = useState(1);

  useEffect(() => {
    setQtyDrafts(
      Object.fromEntries(props.bomChildren.map((entry) => [entry.childItemId, entry.qty]))
    );
  }, [props.bomChildren]);

  useEffect(() => {
    if (!props.editMode || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((response) => response.json())
        .then((rows) => {
          setResults(
            (rows || []).filter((row: SearchItem) => row.id !== props.itemId)
          );
        })
        .catch(() => setResults([]));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [props.editMode, props.itemId, query]);

  async function upsertBom(childItemId: string, qty: number) {
    const response = await fetch(`/api/items/${props.itemId}/bom`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childItemId, qty })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      alert(data?.error || tr("Stueckliste konnte nicht gespeichert werden", "Bill of materials could not be saved"));
      return;
    }

    setQuery("");
    setResults([]);
    await props.onChanged();
  }

  async function removeBom(childItemId: string) {
    const response = await fetch(`/api/items/${props.itemId}/bom`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childItemId })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      alert(data?.error || tr("Stueckliste konnte nicht geloescht werden", "Bill of materials could not be deleted"));
      return;
    }
    await props.onChanged();
  }

  return (
    <section className="rounded-xl border border-workshop-200 bg-[var(--app-surface)] p-4">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-[var(--app-text)]">{tr("Stueckliste", "Bill of materials")}</h3>
        <span className="theme-muted text-sm">{props.bomChildren.length} {tr("Komponenten", "components")}</span>
      </div>

      {props.editMode && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <input
              className="input w-full sm:min-w-[16rem] sm:flex-1"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tr("Komponente suchen (Code, Name, MPN)", "Search component (code, name, MPN)")}
            />
            <input
              className="input w-full sm:w-24"
              type="number"
              min={1}
              value={newQty}
              onChange={(event) => setNewQty(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
          {results.length > 0 && (
            <ul className="space-y-2 rounded-xl border border-workshop-200 p-2 text-sm">
              {results.slice(0, 8).map((result) => (
                <li key={result.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{result.labelCode}</p>
                    <p className="theme-muted">{result.name}</p>
                  </div>
                  <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => upsertBom(result.id, newQty)}>
                    {tr("Hinzufuegen", "Add")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="theme-muted mb-2 text-sm font-semibold">{tr("Komponenten", "Components")}</p>
          <ul className="space-y-2">
            {props.bomChildren.map((entry) => (
              <li key={entry.childItemId} className="rounded-xl border border-workshop-200 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/items/${entry.child.id}`} className="font-medium text-workshop-700 underline">
                      {entry.child.labelCode}
                    </Link>
                    <p>{entry.child.name}</p>
                    <p className="theme-muted text-sm">
                      {tr("Bestand", "Stock")}: {entry.child.stock} {entry.child.unit} • {tr("Ort", "Location")}: {entry.child.storageLocation.name}
                    </p>
                  </div>
                  {props.editMode ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="input w-full sm:w-20"
                        type="number"
                        min={1}
                        value={qtyDrafts[entry.childItemId] ?? entry.qty}
                        onChange={(event) =>
                          setQtyDrafts((current) => ({
                            ...current,
                            [entry.childItemId]: Math.max(1, Number(event.target.value) || 1)
                          }))
                        }
                      />
                      <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => upsertBom(entry.childItemId, qtyDrafts[entry.childItemId] ?? entry.qty)}>
                        {tr("Menge", "Qty")}
                      </button>
                      <button type="button" className="rounded p-2 [color:var(--app-danger-text)]" onClick={() => removeBom(entry.childItemId)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="theme-surface-tonal rounded-full px-3 py-1 text-sm">x {entry.qty}</span>
                  )}
                </div>
              </li>
            ))}
            {props.bomChildren.length === 0 && (
              <li className="theme-muted text-sm">{tr("Keine Komponenten hinterlegt.", "No components assigned.")}</li>
            )}
          </ul>
        </div>

        <div>
          <p className="theme-muted mb-2 text-sm font-semibold">{tr("Verwendet in Baugruppen", "Used in assemblies")}</p>
          <ul className="space-y-2">
            {props.bomParents.map((entry) => (
              <li key={entry.parentItemId} className="rounded-xl border border-workshop-200 p-3">
                <Link href={`/items/${entry.parent.id}`} className="font-medium text-workshop-700 underline">
                  {entry.parent.labelCode}
                </Link>
                <p>{entry.parent.name}</p>
                <p className="theme-muted text-sm">
                  {tr("Verwendet", "Used")}: x {entry.qty} • {tr("Ort", "Location")}: {entry.parent.storageLocation.name}
                </p>
              </li>
            ))}
            {props.bomParents.length === 0 && (
              <li className="theme-muted text-sm">{tr("Dieses Item ist in keiner Baugruppe referenziert.", "This item is not referenced in any assembly.")}</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
