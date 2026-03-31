"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppLanguage } from "@/components/app-language-provider";
import { translateApiErrorMessage } from "@/lib/app-language";

type LocationOption = {
  id: string;
  name: string;
  code?: string | null;
};

type ShelfOption = {
  id: string;
  name: string;
  storageLocationId: string;
};

type SessionSummary = {
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
  ownerUser: {
    id: string;
    name: string;
    email: string;
  };
  progress: {
    totalRows: number;
    countedRows: number;
    remainingRows: number;
    deltaRows: number;
  };
  canEdit: boolean;
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

export default function InventoryPage() {
  const router = useRouter();
  const { language } = useAppLanguage();
  const locale = language === "en" ? "en-US" : "de-DE";
  const tr = useCallback((de: string, en: string) => (language === "en" ? en : de), [language]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [canCreate, setCanCreate] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [shelves, setShelves] = useState<ShelfOption[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [filterLocationId, setFilterLocationId] = useState("");
  const [form, setForm] = useState({
    storageLocationId: "",
    storageArea: "",
    title: "",
    note: ""
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [metaRes, sessionsRes] = await Promise.all([
        fetch("/api/meta", { cache: "no-store" }),
        fetch("/api/inventory/sessions", { cache: "no-store" })
      ]);

      const meta = await metaRes.json();
      const sessionData = await sessionsRes.json();

      if (!metaRes.ok) {
        throw new Error(meta?.error || tr("Metadaten konnten nicht geladen werden.", "Metadata could not be loaded."));
      }
      if (!sessionsRes.ok) {
        throw new Error(sessionData?.error || tr("Inventur-Sessions konnten nicht geladen werden.", "Inventory sessions could not be loaded."));
      }

      setLocations(meta.locations || []);
      setShelves(meta.shelves || []);
      setSessions(sessionData.sessions || []);
      setCanCreate(!!sessionData.canCreate);
      setForm((prev) => ({
        ...prev,
        storageLocationId: prev.storageLocationId || meta.locations?.[0]?.id || ""
      }));
    } catch (loadError) {
      setError((loadError as Error).message || tr("Inventur-Sessions konnten nicht geladen werden.", "Inventory sessions could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    load();
  }, [load]);

  const availableShelves = useMemo(
    () => shelves.filter((shelf) => shelf.storageLocationId === form.storageLocationId),
    [form.storageLocationId, shelves]
  );

  const filteredSessions = useMemo(
    () => sessions.filter((session) => !filterLocationId || session.storageLocationId === filterLocationId),
    [filterLocationId, sessions]
  );

  const openSessions = useMemo(
    () => filteredSessions.filter((session) => session.status === "OPEN"),
    [filteredSessions]
  );
  const closedSessions = useMemo(
    () => filteredSessions.filter((session) => session.status !== "OPEN"),
    [filteredSessions]
  );

  async function createSession() {
    if (!form.storageLocationId) {
      setError(tr("Bitte einen Lagerort auswaehlen.", "Please choose a storage location."));
      return;
    }

    setCreating(true);
    setError("");
    setFeedback("");

    try {
      const res = await fetch("/api/inventory/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storageLocationId: form.storageLocationId,
          storageArea: form.storageArea.trim() || null,
          title: form.title.trim() || null,
          note: form.note.trim() || null
        })
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(translateApiErrorMessage(language, data?.error) || tr("Inventur-Session konnte nicht angelegt werden.", "Inventory session could not be created."));
        return;
      }

      setFeedback(tr("Inventur-Session angelegt.", "Inventory session created."));
      router.push(`/inventory/${data.id}`);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{tr("Inventur-Sessions", "Inventory Sessions")}</h1>
          <p className="text-sm text-workshop-700">
            {tr("Inventuren werden als Session vorbereitet, gezaehlt, geprueft und erst beim Finalize gebucht.", "Stock audits are prepared, counted, reviewed, and only posted on finalize.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-workshop-700">
            <span className="mb-1 block">{tr("Lagerort-Filter", "Location filter")}</span>
            <select
              className="input min-w-[220px]"
              value={filterLocationId}
              onChange={(event) => setFilterLocationId(event.target.value)}
            >
              <option value="">{tr("Alle erlaubten Lagerorte", "All allowed locations")}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {feedback ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}

      {canCreate ? (
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{tr("Neue Inventur-Session", "New inventory session")}</h2>
            <p className="text-sm text-workshop-700">
              {tr("Eine Session umfasst genau einen Lagerort und optional ein Regal bzw. einen Bereich.", "A session covers exactly one storage location and optionally one shelf or area.")}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-workshop-700">
              <span className="mb-1 block">{tr("Lagerort", "Storage location")}</span>
              <select
                className="input"
                value={form.storageLocationId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    storageLocationId: event.target.value,
                    storageArea: ""
                  }))
                }
              >
                <option value="">{tr("Bitte waehlen", "Please choose")}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-workshop-700">
              <span className="mb-1 block">{tr("Regal / Bereich (optional)", "Shelf / area (optional)")}</span>
              <select
                className="input"
                value={form.storageArea}
                onChange={(event) => setForm((prev) => ({ ...prev, storageArea: event.target.value }))}
                disabled={!form.storageLocationId}
              >
                <option value="">{tr("Ganzer Lagerort", "Entire location")}</option>
                {availableShelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.name}>
                    {shelf.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-workshop-700">
              <span className="mb-1 block">{tr("Titel (optional)", "Title (optional)")}</span>
              <input
                className="input"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder={tr("z. B. Schrank Nord", "e.g. Cabinet North")}
              />
            </label>
            <label className="text-sm text-workshop-700">
              <span className="mb-1 block">{tr("Notiz (optional)", "Note (optional)")}</span>
              <input
                className="input"
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder={tr("Freitext", "Free text")}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn" onClick={createSession} disabled={creating}>
              {creating ? tr("Lege an...", "Creating...") : tr("Session anlegen", "Create session")}
            </button>
            <button className="btn-secondary" onClick={load} disabled={loading}>
              {tr("Neu laden", "Reload")}
            </button>
          </div>
        </div>
      ) : (
        <div className="card text-sm text-workshop-700">
          {tr("Inventur-Sessions koennen hier gelesen werden. Neue Sessions koennen nur Nutzer mit Schreibrechten anlegen.", "Inventory sessions can be viewed here. New sessions can only be created by users with write permissions.")}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tr("Offene Sessions", "Open sessions")}</h2>
          <span className="text-sm text-workshop-700">{openSessions.length} {tr("offen", "open")}</span>
        </div>
        {loading ? (
          <div className="card text-sm text-workshop-700">{tr("Lade...", "Loading...")}</div>
        ) : openSessions.length ? (
          <div className="grid gap-3">
            {openSessions.map((session) => (
              <Link
                key={session.id}
                href={`/inventory/${session.id}`}
                className="card block space-y-2 transition hover:border-workshop-400"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-workshop-600">{statusLabel(session.status, tr)}</p>
                    <h3 className="text-lg font-semibold">{session.title || session.scopeLabel}</h3>
                    <p className="text-sm text-workshop-700">{session.scopeLabel}</p>
                  </div>
                  <div className="text-sm text-workshop-700 md:text-right">
                    <p>{tr("Verantwortlich", "Owner")}: {session.ownerUser.name}</p>
                    <p>{tr("Aktualisiert", "Updated")}: {formatDateTime(session.updatedAt, locale)}</p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-workshop-700 md:grid-cols-4">
                  <p>{tr("Positionen", "Rows")}: {session.progress.totalRows}</p>
                  <p>{tr("Gezaehlt", "Counted")}: {session.progress.countedRows}</p>
                  <p>{tr("Offen", "Open")}: {session.progress.remainingRows}</p>
                  <p>{tr("Differenzen", "Differences")}: {session.progress.deltaRows}</p>
                </div>
                {session.note ? <p className="text-sm text-workshop-700">{session.note}</p> : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className="card text-sm text-workshop-700">{tr("Keine offenen Inventur-Sessions im gewaehlten Scope.", "No open inventory sessions in the selected scope.")}</div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tr("Abgeschlossene Sessions", "Closed sessions")}</h2>
          <span className="text-sm text-workshop-700">{closedSessions.length} {tr("abgeschlossen", "closed")}</span>
        </div>
        {loading ? (
          <div className="card text-sm text-workshop-700">{tr("Lade...", "Loading...")}</div>
        ) : closedSessions.length ? (
          <div className="overflow-x-auto rounded-2xl border border-workshop-200 bg-white">
            <table className="min-w-[860px] w-full text-sm">
              <thead>
                <tr className="border-b border-workshop-200 text-left text-workshop-700">
                  <th className="px-3 py-2">{tr("Status", "Status")}</th>
                  <th className="px-3 py-2">{tr("Scope", "Scope")}</th>
                  <th className="px-3 py-2">{tr("Verantwortlich", "Owner")}</th>
                  <th className="px-3 py-2">{tr("Gezaehlt", "Counted")}</th>
                  <th className="px-3 py-2">{tr("Differenzen", "Differences")}</th>
                  <th className="px-3 py-2">{tr("Abschluss", "Completed")}</th>
                  <th className="px-3 py-2">{tr("Aktion", "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {closedSessions.map((session) => (
                  <tr key={session.id} className="border-b border-workshop-100 align-top">
                    <td className="px-3 py-2">{statusLabel(session.status, tr)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{session.title || session.scopeLabel}</div>
                      <div className="text-workshop-700">{session.scopeLabel}</div>
                    </td>
                    <td className="px-3 py-2">{session.ownerUser.name}</td>
                    <td className="px-3 py-2">{session.progress.countedRows} / {session.progress.totalRows}</td>
                    <td className="px-3 py-2">{session.progress.deltaRows}</td>
                    <td className="px-3 py-2">
                      {session.status === "FINALIZED" ? formatDateTime(session.finalizedAt, locale) : formatDateTime(session.cancelledAt, locale)}
                    </td>
                    <td className="px-3 py-2">
                      <Link className="btn-secondary" href={`/inventory/${session.id}`}>
                        {tr("Details", "Details")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-sm text-workshop-700">{tr("Noch keine abgeschlossenen Inventur-Sessions im gewaehlten Scope.", "No completed inventory sessions in the selected scope yet.")}</div>
        )}
      </section>
    </div>
  );
}
