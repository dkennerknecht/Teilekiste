"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("de-DE");
}

function statusLabel(status: string) {
  if (status === "OPEN") return "Offen";
  if (status === "FINALIZED") return "Finalisiert";
  if (status === "CANCELLED") return "Abgebrochen";
  return status;
}

function getStoragePlaceLabel(storageArea?: string | null, bin?: string | null) {
  return [storageArea || null, bin || null].filter(Boolean).join(" / ") || "-";
}

export default function InventorySessionDetailPage({ params }: { params: { id: string } }) {
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
        throw new Error(data?.error || "Inventur-Session konnte nicht geladen werden.");
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
      setError((loadError as Error).message || "Inventur-Session konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

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
        setError(data?.error || "Zaehlstaende konnten nicht gespeichert werden.");
        return false;
      }

      setFeedback(`${payload.length} Position${payload.length === 1 ? "" : "en"} gespeichert.`);
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

    const confirmed = window.confirm("Inventur-Session jetzt finalisieren und gezaehlte Differenzen buchen?");
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
        setError(data?.error || "Inventur-Session konnte nicht finalisiert werden.");
        return;
      }

      setFeedback("Inventur-Session finalisiert.");
      await load();
    } finally {
      setFinalizing(false);
    }
  }

  async function cancelSession() {
    if (!detail) return;

    const confirmed = window.confirm("Inventur-Session ohne Bestandsaenderungen abbrechen?");
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
        setError(data?.error || "Inventur-Session konnte nicht abgebrochen werden.");
        return;
      }

      setFeedback("Inventur-Session abgebrochen.");
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
      setError("Kein passender Label-Code in dieser Inventur-Session gefunden.");
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
    return <p>Lade...</p>;
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link className="btn-secondary inline-flex" href="/inventory">
          Zurueck zur Inventur-Uebersicht
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Inventur-Session konnte nicht geladen werden."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Link className="btn-secondary inline-flex" href="/inventory">
            Zurueck zur Inventur-Uebersicht
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-workshop-600">{statusLabel(detail.status)}</p>
            <h1 className="text-2xl font-semibold">{detail.title || detail.scopeLabel}</h1>
            <p className="text-sm text-workshop-700">{detail.scopeLabel}</p>
          </div>
        </div>
        <div className="grid gap-2 text-sm text-workshop-700 md:text-right">
          <p>Owner: {detail.ownerUser.name}</p>
          <p>Erstellt: {formatDateTime(detail.createdAt)}</p>
          <p>Zuletzt aktualisiert: {formatDateTime(detail.updatedAt)}</p>
          {detail.status === "FINALIZED" ? <p>Finalisiert: {formatDateTime(detail.finalizedAt)}</p> : null}
          {detail.status === "CANCELLED" ? <p>Abgebrochen: {formatDateTime(detail.cancelledAt)}</p> : null}
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {feedback ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Session-Status</h2>
            <p className="text-sm text-workshop-700">
              Nicht gezaehlte Positionen bleiben unveraendert. Finalize bucht nur gespeicherte Zaehleintraege.
            </p>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-xl border border-workshop-200 px-3 py-2">
              <p className="text-workshop-700">Positionen</p>
              <p className="text-xl font-semibold">{detail.summary.totalRows}</p>
            </div>
            <div className="rounded-xl border border-workshop-200 px-3 py-2">
              <p className="text-workshop-700">Gezaehlt</p>
              <p className="text-xl font-semibold">{detail.summary.countedRows}</p>
            </div>
            <div className="rounded-xl border border-workshop-200 px-3 py-2">
              <p className="text-workshop-700">Offen</p>
              <p className="text-xl font-semibold">{detail.summary.remainingRows}</p>
            </div>
            <div className="rounded-xl border border-workshop-200 px-3 py-2">
              <p className="text-workshop-700">Differenzen</p>
              <p className="text-xl font-semibold">{detail.summary.deltaRows}</p>
            </div>
            <div className="rounded-xl border border-workshop-200 px-3 py-2">
              <p className="text-workshop-700">Warnungen</p>
              <p className="text-xl font-semibold">{detail.summary.warningCount}</p>
            </div>
            <div className="rounded-xl border border-workshop-200 px-3 py-2">
              <p className="text-workshop-700">Blocker</p>
              <p className="text-xl font-semibold">{detail.summary.blockingCount}</p>
            </div>
          </div>
          {detail.note ? <p className="text-sm text-workshop-700">{detail.note}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button className="btn" onClick={() => saveRows()} disabled={!detail.canEdit || !dirtyCount || saving}>
              {saving ? "Speichere..." : dirtyCount ? `Zaehlstaende speichern (${dirtyCount})` : "Keine ungespeicherten Aenderungen"}
            </button>
            <button
              className="btn-secondary"
              onClick={finalizeSession}
              disabled={!detail.canFinalize || finalizing || saving || cancelling}
            >
              {finalizing ? "Finalisiere..." : "Finalize"}
            </button>
            <button
              className="btn-secondary"
              onClick={cancelSession}
              disabled={!detail.canEdit || detail.status !== "OPEN" || cancelling || finalizing}
            >
              {cancelling ? "Breche ab..." : "Session abbrechen"}
            </button>
            <button className="btn-secondary" onClick={load} disabled={loading || saving || finalizing || cancelling}>
              Neu laden
            </button>
          </div>
        </div>

        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Scan / Sprung</h2>
            <p className="text-sm text-workshop-700">
              Label-Code scannen oder eingeben, um direkt zur passenden Zeile zu springen.
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
              placeholder="Label-Code"
            />
            <button className="btn" onClick={jumpToCode}>
              Springen
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Review</h3>
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
              <p className="text-sm text-workshop-700">Keine Warnungen. Die Session ist aus Review-Sicht konsistent.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card hidden md:block">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Zaehlliste</h2>
            <p className="text-sm text-workshop-700">Sortierung: Regal / Fach / Label-Code</p>
          </div>
          <p className="text-sm text-workshop-700">{detail.rows.length} Positionen</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1260px] w-full text-sm">
            <thead>
              <tr className="border-b border-workshop-200 text-left text-workshop-700">
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Platz</th>
                <th className="px-2 py-2">Soll</th>
                <th className="px-2 py-2">Ist</th>
                <th className="px-2 py-2">Aktuell</th>
                <th className="px-2 py-2">Delta</th>
                <th className="px-2 py-2">Reserviert</th>
                <th className="px-2 py-2">Notiz</th>
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
                          gespeichert {formatDateTime(row.countedAt)}
                          {row.countedByUser ? ` von ${row.countedByUser.name}` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <div>{getStoragePlaceLabel(row.storageArea, row.bin)}</div>
                      {row.hasDrift ? (
                        <div className="text-xs text-amber-700">
                          jetzt: {getStoragePlaceLabel(row.currentStorageArea, row.currentBin)}
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
                            Reset
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-2">{formatDisplayQuantity(row.unit, row.currentStock)}</td>
                    <td className="px-2 py-2">
                      {row.delta === null ? "-" : `${row.delta > 0 ? "+" : ""}${formatDisplayQuantity(row.unit, row.delta)}`}
                      {row.liveDelta !== null && row.hasDrift ? (
                        <div className="text-xs text-workshop-600">
                          live: {row.liveDelta > 0 ? "+" : ""}
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
                      {dirtySet.has(row.itemId) ? <div className="mt-1 text-xs text-workshop-600">Ungespeichert</div> : null}
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
                <p>Soll: {formatDisplayQuantity(row.unit, row.expectedStock)}</p>
                <p>Aktuell: {formatDisplayQuantity(row.unit, row.currentStock)}</p>
                <p>Reserviert: {formatDisplayQuantity(row.unit, row.reservedQty)}</p>
              </div>
              <label className="text-sm text-workshop-700">
                <span className="mb-1 block">Ist</span>
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
                <span className="mb-1 block">Notiz</span>
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
