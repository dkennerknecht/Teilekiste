"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";

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
  const { language } = useAppLanguage();
  const locale = language === "en" ? "en-US" : "de-DE";
  const tr = (de: string, en: string) => (language === "en" ? en : de);
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
        <h1 className="text-2xl font-semibold">{tr("Audit-Historie", "Audit History")}</h1>
        <Link className="btn-secondary" href="/admin">
          {tr("Zurueck zu Admin", "Back to admin")}
        </Link>
      </div>

      <div className="card flex flex-wrap gap-2">
        <input
          className="input min-w-64"
          placeholder={tr("Suche nach Aktion, User, Item oder ID", "Search by action, user, item, or ID")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="input" value={entity} onChange={(event) => setEntity(event.target.value)}>
          <option value="">{tr("Alle Entities", "All entities")}</option>
          <option value="Item">Item</option>
        </select>
        <input
          className="input"
          placeholder={tr("Action-Filter, z.B. ITEM_UPDATE", "Action filter, e.g. ITEM_UPDATE")}
          value={action}
          onChange={(event) => setAction(event.target.value)}
        />
      </div>

      <div className="card space-y-2">
        {loading ? (
          <p>{tr("Lade...", "Loading...")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-workshop-700">{tr("Keine Audit-Eintraege gefunden.", "No audit entries found.")}</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded border border-workshop-200 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{row.summary}</p>
                <span className="text-workshop-700">{new Date(row.createdAt).toLocaleString(locale)}</span>
              </div>
              <p className="mt-1 text-workshop-700">
                {row.action} • {row.entity} • {row.user?.name || row.user?.email || tr("System", "System")}
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
