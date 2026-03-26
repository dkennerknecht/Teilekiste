"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  summary: string;
  user: { name?: string | null; email?: string | null } | null;
  item: { id: string; labelCode: string; name: string } | null;
};

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (entity) params.set("entity", entity);
      if (action.trim()) params.set("action", action.trim());

      fetch(`/api/admin/audit?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal
      })
        .then((response) => response.json())
        .then((data) => setRows(data.items || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [action, entity, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Audit History</h1>
        <Link className="btn-secondary" href="/admin">
          Zurück zu Admin
        </Link>
      </div>

      <div className="card flex flex-wrap gap-2">
        <input
          className="input min-w-64"
          placeholder="Suche nach Aktion, User, Item oder ID"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="input" value={entity} onChange={(event) => setEntity(event.target.value)}>
          <option value="">Alle Entities</option>
          <option value="Item">Item</option>
        </select>
        <input
          className="input"
          placeholder="Action-Filter, z.B. ITEM_UPDATE"
          value={action}
          onChange={(event) => setAction(event.target.value)}
        />
      </div>

      <div className="card space-y-2">
        {loading ? (
          <p>Lade...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-workshop-700">Keine Audit-Einträge gefunden.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded border border-workshop-200 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{row.summary}</p>
                <span className="text-workshop-700">{new Date(row.createdAt).toLocaleString("de-DE")}</span>
              </div>
              <p className="mt-1 text-workshop-700">
                {row.action} • {row.entity} • {row.user?.name || row.user?.email || "System"}
              </p>
              {row.item && (
                <p className="mt-1">
                  <Link href={`/items/${row.item.id}`} className="text-workshop-700 underline">
                    {row.item.labelCode} - {row.item.name}
                  </Link>
                </p>
              )}
              {!row.item && <p className="mt-1 font-mono text-xs text-workshop-700">{row.entityId}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
