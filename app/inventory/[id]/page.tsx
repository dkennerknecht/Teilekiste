"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";
import { formatDisplayQuantity, getQuantityStep } from "@/lib/quantity";

type SessionDetailRow = {
  id: string;
  itemId: string;
  labelCode: string;
  name: string;
  unit: string;
  storageArea: string | null;
  bin: string | null;
  expectedStock: number | null;
  countedStock: number | null;
  currentStock: number | null;
  reservedQty: number | null;
  delta: number | null;
  liveDelta: number | null;
  currentStorageArea: string | null;
  currentBin: string | null;
  itemDeleted: boolean;
  itemArchived: boolean;
  countedAt: string | null;
  countedByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  note: string | null;
  hasDrift: boolean;
};

type SessionDetail = {
  id: string;
  title: string | null;
  status: string;
  storageLocationId: string;
  storageArea: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  cancelledAt: string | null;
  scopeLabel: string;
  storageLocation: {
    id: string;
    name: string;
    code?: string | null;
  };
  ownerUser: {
    id: string;
    name: string;
    email: string;
  };
  summary: {
    totalRows: number;
    countedRows: number;
    remainingRows: number;
    deltaRows: number;
    warningCount: number;
    blockingCount: number;
  };
  canEdit: boolean;
  canFinalize: boolean;
  warnings: Array<{
    rowId: string;
    itemId: string;
    labelCode: string;
    severity: "warning" | "error";
    message: string;
  }>;
  rows: SessionDetailRow[];
};

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString(locale);
}

function statusLabel(status: string, tr: (de: string, en: string) => string) {
  if (status === "OPEN") return tr("Offen", "Open");
  if (status === "FINALIZED") return tr("Finalisiert", "Finalized");
  if (status === "CANCELLED") return tr("Abgebrochen", "Cancelled");
  return status;
}

function getStoragePlaceLabel(storageArea?: string | null, bin?: string | null) {
  return [storageArea || null, bin || null].filter(Boolean).join(" / ") || "-";
}

export default function InventorySessionDetailPage({ params }: { params: { id: string } }) {
  const { language } = useAppLanguage();
  const locale = language === "en" ? "en-US" : "de-DE";
  const tr = useCallback((de: string, en: string) => (language === "en" ? en : de), [language]);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [draftCounts, setDraftCounts] = useState<Record<string, string>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [dirtyItemIds, setDirtyItemIds] = useState<string[]>([]);
  const countInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/inventory/sessions/${params.id}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || tr("Inventur-Session konnte nicht geladen werden.", "Inventory session could not be loaded."));
      }
      setDetail(data);
      setDraftCounts(
        Object.fromEntries((data.rows || []).map((row: SessionDetailRow) => [row.itemId, row.countedStock === null ? "" : String(row.countedStock)]))
      );
      setDraftNotes(
        Object.fromEntries((data.rows || []).map((row: SessionDetailRow) => [row.itemId, row.note || ""]))
      );
      setDirtyItemIds([]);
    } catch (loadError) {
      setError((loadError as Error).message || tr("Inventur-Session konnte nicht geladen werden.", "Inventory session could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [params.id, tr]);

  useEffect(() => {
    load();
  }, [load]);

  const dirtySet = useMemo(() => new Set(dirtyItemIds), [dirtyItemIds]);
  const dirtyCount = dirtyItemIds.length;

  const warningByRowId = useMemo(() => {
    const map = new Map<string, Array<{ severity: "warning" | "error"; message: string }>>();
    for (const warning of detail?.warnings || []) {
      const current = map.get(warning.rowId) || [];
      current.push({ severity: warning.severity, message: warning.message });
      map.set(warning.rowId, current);
    }
    return map;
  }, [detail?.warnings]);

  function markDirty(itemId: string) {
    setDirtyItemIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
  }

  function setDraftCount(itemId: string, value: string) {
    setDraftCounts((prev) => ({ ...prev, [itemId]: value }));
    markDirty(itemId);
  }

  function setDraftNote(itemId: string, value: string) {
    setDraftNotes((prev) => ({ ...prev, [itemId]: value }));
    markDirty(itemId);
  }

  async function saveRows(itemIds?: string[]) {
    if (!detail) return false;

    const idsToSave = (itemIds || dirtyItemIds).filter((itemId, index, all) => all.indexOf(itemId) === index);
    if (!idsToSave.length) return true;

    setSaving(true);
    setError("");
    setFeedback("");

    try {
      const payload = idsToSave.map((itemId) => ({
        itemId,
        countedStock: String(draftCounts[itemId] || "").trim() === "" ? null : Number(draftCounts[itemId]),
        note: draftNotes[itemId]?.trim() || null
      }));

      const res = await fetch(`/api/inventory/sessions/${detail.id}/counts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ counts: payload })
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || tr("Zaehlstaende konnten nicht gespeichert werden.", "Counts could not be saved."));
        return false;
      }

      setFeedback(
        language === "en"
          ? `${payload.length} row${payload.length === 1 ? "" : "s"} saved.`
          : `${payload.length} Position${payload.length === 1 ? "" : "en"} gespeichert.`
      );
      await load();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function finalizeSession() {
    if (!detail) return;
    if (dirtyCount) {
      const saved = await saveRows();
      if (!saved) return;
    }

    const confirmed = window.confirm(tr("Inventur-Session jetzt finalisieren und gezaehlte Differenzen buchen?", "Finalize the inventory session now and post counted differences?"));
    if (!confirmed) return;

    setFinalizing(true);
    setError("");
    setFeedback("");

    try {
      const res = await fetch(`/api/inventory/sessions/${detail.id}/finalize`, {
        method: "POST"
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || tr("Inventur-Session konnte nicht finalisiert werden.", "Inventory session could not be finalized."));
        return;
      }

      setFeedback(tr("Inventur-Session finalisiert.", "Inventory session finalized."));
      await load();
    } finally {
      setFinalizing(false);
    }
  }

  async function cancelSession() {
    if (!detail) return;

    const confirmed = window.confirm(tr("Inventur-Session ohne Bestandsaenderungen abbrechen?", "Cancel the inventory session without stock changes?"));
    if (!confirmed) return;

    setCancelling(true);
    setError("");
    setFeedback("");

    try {
      const res = await fetch(`/api/inventory/sessions/${detail.id}/cancel`, {
        method: "POST"
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || tr("Inventur-Session konnte nicht abgebrochen werden.", "Inventory session could not be cancelled."));
        return;
      }

      setFeedback(tr("Inventur-Session abgebrochen.", "Inventory session cancelled."));
      await load();
    } finally {
      setCancelling(false);
    }
  }

  function jumpToCode() {
    const normalizedCode = scanCode.trim().toLowerCase();
    if (!normalizedCode || !detail) return;

    const row = detail.rows.find((entry) => entry.labelCode.trim().toLowerCase() === normalizedCode);
    if (!row) {
      setError(tr("Kein passender Label-Code in dieser Inventur-Session gefunden.", "No matching label code found in this inventory session."));
      return;
    }

    setError("");
    rowRefs.current[row.itemId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      countInputRefs.current[row.itemId]?.focus();
      countInputRefs.current[row.itemId]?.select();
    }, 150);
  }

  if (loading && !detail) {
    return <p>{tr("Lade...", "Loading...")}</p>;
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link className="btn-secondary inline-flex" href="/inventory">
          {tr("Zurueck zur Inventur-Uebersicht", "Back to inventory overview")}
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || tr("Inventur-Session konnte nicht geladen werden.", "Inventory session could not be loaded.")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Link className="btn-secondary inline-flex" href="/inventory">
            {tr("Zurueck zur Inventur-Uebersicht", "Back to inventory overview")}
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-workshop-600">{statusLabel(detail.status, tr)}</p>
            <h1 className="text-2xl font-semibold">{detail.title || detail.scopeLabel}</h1>
            <p className="text-sm text-workshop-700">{detail.scopeLabel}</p>
          </div>
        </div>
        <div className="grid gap-2 text-sm text-workshop-700 md:text-right">
          <p>{tr("Verantwortlich", "Owner")}: {detail.ownerUser.name}</p>
          <p>{tr("Erstellt", "Created")}: {formatDateTime(detail.createdAt, locale)}</p>
          <p>{tr("Zuletzt aktualisiert", "Last updated")}: {formatDateTime(detail.updatedAt, locale)}</p>
          {detail.status === "FINALIZED" ? <p>{tr("Finalisiert", "Finalized")}: {formatDateTime(detail.finalizedAt, locale)}</p> : null}
          {detail.status === "CANCELLED" ? <p>{tr("Abgebrochen", "Cancelled")}: {formatDateTime(detail.cancelledAt, locale)}</p> : null}
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {feedback ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{tr("Session-Status", "Session status")}</h2>
            <p className="text-sm text-workshop-700">
              {tr("Nicht gezaehlte Positionen bleiben unveraendert. Finalize bucht nur gespeicherte Zaehleintraege.", "Uncounted rows remain unchanged. Finalize only posts saved count entries.")}
            </p>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-xl border border-workshop-200 px-3 py-2">
              <p className="text-workshop-700">{tr("Positionen", "Rows")}</p>
              <p className="text-xl font-semibold">{detail.summary.totalRows}</p>
            </div>
            <div className="rounded-xl border border-workshop-200 px-3 py-2">
              <p className="text-workshop-700">{tr("Gezaehlt", "Counted")}</p>
              <p className="text-xl font-semibold">{detail.summary.countedRows}</p>
            </div>
            <div className="rounded-xl border border-workshop-200 px-3 py-2">
              <p className="text-workshop-700">{tr("Offen", "Open")}</p>
              <p className="text-xl font-semibold">{detail.summary.remainingRows}</p>
            </div>
            <div className="rounded-xl border border-workshop-200 px-3 py-2">
              <p className="text-workshop-700">{tr("Differenzen", "Differences")}</p>
              <p className="text-xl font-semibold">{detail.summary.deltaRows}</p>
            </div>
            <div className="rounded-xl border border-workshop-200 px-3 py-2">
              <p className="text-workshop-700">{tr("Warnungen", "Warnings")}</p>
              <p className="text-xl font-semibold">{detail.summary.warningCount}</p>
            </div>
            <div className="rounded-xl border border-workshop-200 px-3 py-2">
              <p className="text-workshop-700">{tr("Blocker", "Blockers")}</p>
              <p className="text-xl font-semibold">{detail.summary.blockingCount}</p>
            </div>
          </div>
          {detail.note ? <p className="text-sm text-workshop-700">{detail.note}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button className="btn" onClick={() => saveRows()} disabled={!detail.canEdit || !dirtyCount || saving}>
              {saving ? tr("Speichere...", "Saving...") : dirtyCount ? tr(`Zaehlstaende speichern (${dirtyCount})`, `Save counts (${dirtyCount})`) : tr("Keine ungespeicherten Aenderungen", "No unsaved changes")}
            </button>
            <button
              className="btn-secondary"
              onClick={finalizeSession}
              disabled={!detail.canFinalize || finalizing || saving || cancelling}
            >
              {finalizing ? tr("Finalisiere...", "Finalizing...") : "Finalize"}
            </button>
            <button
              className="btn-secondary"
              onClick={cancelSession}
              disabled={!detail.canEdit || detail.status !== "OPEN" || cancelling || finalizing}
            >
              {cancelling ? tr("Breche ab...", "Cancelling...") : tr("Session abbrechen", "Cancel session")}
            </button>
            <button className="btn-secondary" onClick={load} disabled={loading || saving || finalizing || cancelling}>
              {tr("Neu laden", "Reload")}
            </button>
          </div>
        </div>

        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{tr("Scan / Sprung", "Scan / jump")}</h2>
            <p className="text-sm text-workshop-700">
              {tr("Label-Code scannen oder eingeben, um direkt zur passenden Zeile zu springen.", "Scan or enter a label code to jump directly to the matching row.")}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="input flex-1"
              value={scanCode}
              onChange={(event) => setScanCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  jumpToCode();
                }
              }}
              placeholder={tr("Label-Code", "Label code")}
            />
            <button className="btn" onClick={jumpToCode}>
              {tr("Springen", "Jump")}
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">{tr("Review", "Review")}</h3>
            {detail.warnings.length ? (
              <ul className="max-h-64 space-y-2 overflow-auto text-sm">
                {detail.warnings.map((warning) => (
                  <li
                    key={`${warning.rowId}-${warning.message}`}
                    className={`rounded-xl border px-3 py-2 ${
                      warning.severity === "error"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    <span className="font-mono">{warning.labelCode}</span>: {warning.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-workshop-700">{tr("Keine Warnungen. Die Session ist aus Review-Sicht konsistent.", "No warnings. The session is consistent from a review perspective.")}</p>
            )}
          </div>
        </div>
      </div>

      <div className="card hidden md:block">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{tr("Zaehlliste", "Count list")}</h2>
            <p className="text-sm text-workshop-700">{tr("Sortierung: Regal / Fach / Label-Code", "Sorting: shelf / bin / label code")}</p>
          </div>
          <p className="text-sm text-workshop-700">{detail.rows.length} {tr("Positionen", "rows")}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1260px] w-full text-sm">
            <thead>
              <tr className="border-b border-workshop-200 text-left text-workshop-700">
                <th className="px-2 py-2">{tr("Code", "Code")}</th>
                <th className="px-2 py-2">{tr("Name", "Name")}</th>
                <th className="px-2 py-2">{tr("Platz", "Place")}</th>
                <th className="px-2 py-2">{tr("Soll", "Expected")}</th>
                <th className="px-2 py-2">{tr("Ist", "Counted")}</th>
                <th className="px-2 py-2">{tr("Aktuell", "Current")}</th>
                <th className="px-2 py-2">Delta</th>
                <th className="px-2 py-2">{tr("Reserviert", "Reserved")}</th>
                <th className="px-2 py-2">{tr("Notiz", "Note")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.rows.map((row) => {
                const rowWarnings = warningByRowId.get(row.id) || [];
                const rowHasError = rowWarnings.some((warning) => warning.severity === "error");
                const rowHasWarning = rowWarnings.some((warning) => warning.severity === "warning");
                return (
                  <tr
                    key={row.id}
                    ref={(element) => {
                      rowRefs.current[row.itemId] = element;
                    }}
                    className={`border-b border-workshop-100 align-top ${
                      rowHasError ? "bg-red-50" : rowHasWarning ? "bg-amber-50" : ""
                    }`}
                  >
                    <td className="px-2 py-2 font-mono">{row.labelCode}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{row.name}</div>
                      {row.countedAt ? (
                        <div className="text-xs text-workshop-600">
                          {tr("gespeichert", "saved")} {formatDateTime(row.countedAt, locale)}
                          {row.countedByUser ? ` ${tr("von", "by")} ${row.countedByUser.name}` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <div>{getStoragePlaceLabel(row.storageArea, row.bin)}</div>
                      {row.hasDrift ? (
                        <div className="text-xs text-amber-700">
                          {tr("jetzt", "now")}: {getStoragePlaceLabel(row.currentStorageArea, row.currentBin)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">{formatDisplayQuantity(row.unit, row.expectedStock)}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          ref={(element) => {
                            countInputRefs.current[row.itemId] = element;
                          }}
                          className="input w-28"
                          type="number"
                          step={getQuantityStep(row.unit)}
                          value={draftCounts[row.itemId] ?? ""}
                          onChange={(event) => setDraftCount(row.itemId, event.target.value)}
                          disabled={!detail.canEdit}
                        />
                        {detail.canEdit ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              setDraftCount(row.itemId, "");
                              setDraftNote(row.itemId, "");
                            }}
                          >
                            {tr("Reset", "Reset")}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-2">{formatDisplayQuantity(row.unit, row.currentStock)}</td>
                    <td className="px-2 py-2">
                      {row.delta === null ? "-" : `${row.delta > 0 ? "+" : ""}${formatDisplayQuantity(row.unit, row.delta)}`}
                      {row.liveDelta !== null && row.hasDrift ? (
                        <div className="text-xs text-workshop-600">
                          {tr("live", "live")}: {row.liveDelta > 0 ? "+" : ""}
                          {formatDisplayQuantity(row.unit, row.liveDelta)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">{formatDisplayQuantity(row.unit, row.reservedQty)}</td>
                    <td className="px-2 py-2">
                      <textarea
                        className="input min-h-[72px] w-full"
                        value={draftNotes[row.itemId] ?? ""}
                        onChange={(event) => setDraftNote(row.itemId, event.target.value)}
                        disabled={!detail.canEdit}
                      />
                      {dirtySet.has(row.itemId) ? <div className="mt-1 text-xs text-workshop-600">{tr("Ungespeichert", "Unsaved")}</div> : null}
                      {rowWarnings.length ? (
                        <div className="mt-1 space-y-1 text-xs">
                          {rowWarnings.map((warning, index) => (
                            <div key={`${row.id}-${index}`} className={warning.severity === "error" ? "text-red-700" : "text-amber-800"}>
                              {warning.message}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {detail.rows.map((row) => {
          const rowWarnings = warningByRowId.get(row.id) || [];
          const rowHasError = rowWarnings.some((warning) => warning.severity === "error");
          const rowHasWarning = rowWarnings.some((warning) => warning.severity === "warning");
          return (
            <div
              key={row.id}
              className={`card space-y-3 ${
                rowHasError ? "border-red-200 bg-red-50" : rowHasWarning ? "border-amber-200 bg-amber-50" : ""
              }`}
            >
              <div>
                <p className="font-mono text-sm text-workshop-700">{row.labelCode}</p>
                <p className="font-medium">{row.name}</p>
                <p className="text-sm text-workshop-700">{getStoragePlaceLabel(row.storageArea, row.bin)}</p>
              </div>
              <div className="grid gap-2 text-sm text-workshop-700">
                <p>{tr("Soll", "Expected")}: {formatDisplayQuantity(row.unit, row.expectedStock)}</p>
                <p>{tr("Aktuell", "Current")}: {formatDisplayQuantity(row.unit, row.currentStock)}</p>
                <p>{tr("Reserviert", "Reserved")}: {formatDisplayQuantity(row.unit, row.reservedQty)}</p>
              </div>
              <label className="text-sm text-workshop-700">
                <span className="mb-1 block">{tr("Ist", "Counted")}</span>
                <input
                  className="input"
                  type="number"
                  step={getQuantityStep(row.unit)}
                  value={draftCounts[row.itemId] ?? ""}
                  onChange={(event) => setDraftCount(row.itemId, event.target.value)}
                  disabled={!detail.canEdit}
                />
              </label>
              <label className="text-sm text-workshop-700">
                <span className="mb-1 block">{tr("Notiz", "Note")}</span>
                <textarea
                  className="input min-h-[84px]"
                  value={draftNotes[row.itemId] ?? ""}
                  onChange={(event) => setDraftNote(row.itemId, event.target.value)}
                  disabled={!detail.canEdit}
                />
              </label>
              {rowWarnings.length ? (
                <div className="space-y-1 text-xs">
                  {rowWarnings.map((warning, index) => (
                    <div key={`${row.id}-${index}`} className={warning.severity === "error" ? "text-red-700" : "text-amber-800"}>
                      {warning.message}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
