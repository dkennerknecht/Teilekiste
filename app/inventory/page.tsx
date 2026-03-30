"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function InventoryPage() {
  const router = useRouter();
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

  async function load() {
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
        throw new Error(meta?.error || "Metadaten konnten nicht geladen werden.");
      }
      if (!sessionsRes.ok) {
        throw new Error(sessionData?.error || "Inventur-Sessions konnten nicht geladen werden.");
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
      setError((loadError as Error).message || "Inventur-Sessions konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
      setError("Bitte einen Lagerort auswaehlen.");
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
        setError(data?.error || "Inventur-Session konnte nicht angelegt werden.");
        return;
      }

      setFeedback("Inventur-Session angelegt.");
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
          <h1 className="text-2xl font-semibold">Inventur-Sessions</h1>
          <p className="text-sm text-workshop-700">
            Inventuren werden als Session vorbereitet, gezaehlt, geprueft und erst beim Finalize gebucht.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-workshop-700">
            <span className="mb-1 block">Lagerort-Filter</span>
            <select
              className="input min-w-[220px]"
              value={filterLocationId}
              onChange={(event) => setFilterLocationId(event.target.value)}
            >
              <option value="">Alle erlaubten Lagerorte</option>
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
            <h2 className="text-lg font-semibold">Neue Inventur-Session</h2>
            <p className="text-sm text-workshop-700">
              Eine Session umfasst genau einen Lagerort und optional ein Regal bzw. einen Bereich.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-workshop-700">
              <span className="mb-1 block">Lagerort</span>
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
                <option value="">Bitte waehlen</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-workshop-700">
              <span className="mb-1 block">Regal / Bereich (optional)</span>
              <select
                className="input"
                value={form.storageArea}
                onChange={(event) => setForm((prev) => ({ ...prev, storageArea: event.target.value }))}
                disabled={!form.storageLocationId}
              >
                <option value="">Ganzer Lagerort</option>
                {availableShelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.name}>
                    {shelf.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-workshop-700">
              <span className="mb-1 block">Titel (optional)</span>
              <input
                className="input"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="z. B. Schrank Nord"
              />
            </label>
            <label className="text-sm text-workshop-700">
              <span className="mb-1 block">Notiz (optional)</span>
              <input
                className="input"
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Freitext"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn" onClick={createSession} disabled={creating}>
              {creating ? "Lege an..." : "Session anlegen"}
            </button>
            <button className="btn-secondary" onClick={load} disabled={loading}>
              Neu laden
            </button>
          </div>
        </div>
      ) : (
        <div className="card text-sm text-workshop-700">
          Inventur-Sessions koennen hier gelesen werden. Neue Sessions koennen nur Nutzer mit Schreibrechten anlegen.
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Offene Sessions</h2>
          <span className="text-sm text-workshop-700">{openSessions.length} offen</span>
        </div>
        {loading ? (
          <div className="card text-sm text-workshop-700">Lade...</div>
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-workshop-600">{statusLabel(session.status)}</p>
                    <h3 className="text-lg font-semibold">{session.title || session.scopeLabel}</h3>
                    <p className="text-sm text-workshop-700">{session.scopeLabel}</p>
                  </div>
                  <div className="text-sm text-workshop-700 md:text-right">
                    <p>Owner: {session.ownerUser.name}</p>
                    <p>Aktualisiert: {formatDateTime(session.updatedAt)}</p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-workshop-700 md:grid-cols-4">
                  <p>Positionen: {session.progress.totalRows}</p>
                  <p>Gezaehlt: {session.progress.countedRows}</p>
                  <p>Offen: {session.progress.remainingRows}</p>
                  <p>Differenzen: {session.progress.deltaRows}</p>
                </div>
                {session.note ? <p className="text-sm text-workshop-700">{session.note}</p> : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className="card text-sm text-workshop-700">Keine offenen Inventur-Sessions im gewaehlten Scope.</div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Abgeschlossene Sessions</h2>
          <span className="text-sm text-workshop-700">{closedSessions.length} abgeschlossen</span>
        </div>
        {loading ? (
          <div className="card text-sm text-workshop-700">Lade...</div>
        ) : closedSessions.length ? (
          <div className="overflow-x-auto rounded-2xl border border-workshop-200 bg-white">
            <table className="min-w-[860px] w-full text-sm">
              <thead>
                <tr className="border-b border-workshop-200 text-left text-workshop-700">
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Gezaehlt</th>
                  <th className="px-3 py-2">Differenzen</th>
                  <th className="px-3 py-2">Abschluss</th>
                  <th className="px-3 py-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {closedSessions.map((session) => (
                  <tr key={session.id} className="border-b border-workshop-100 align-top">
                    <td className="px-3 py-2">{statusLabel(session.status)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{session.title || session.scopeLabel}</div>
                      <div className="text-workshop-700">{session.scopeLabel}</div>
                    </td>
                    <td className="px-3 py-2">{session.ownerUser.name}</td>
                    <td className="px-3 py-2">{session.progress.countedRows} / {session.progress.totalRows}</td>
                    <td className="px-3 py-2">{session.progress.deltaRows}</td>
                    <td className="px-3 py-2">
                      {session.status === "FINALIZED" ? formatDateTime(session.finalizedAt) : formatDateTime(session.cancelledAt)}
                    </td>
                    <td className="px-3 py-2">
                      <Link className="btn-secondary" href={`/inventory/${session.id}`}>
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-sm text-workshop-700">Noch keine abgeschlossenen Inventur-Sessions im gewaehlten Scope.</div>
        )}
      </section>
    </div>
  );
}
