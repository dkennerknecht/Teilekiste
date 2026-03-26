"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type IdObj = { id: string };

export default function AdminPage() {
  const [dash, setDash] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [apiTokens, setApiTokens] = useState<any[]>([]);
  const [newTokenValue, setNewTokenValue] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [labelConfig, setLabelConfig] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [backupResult, setBackupResult] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);

  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editTagId, setEditTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [editLocationName, setEditLocationName] = useState("");
  const [editLocationCode, setEditLocationCode] = useState("");
  const [editCustomId, setEditCustomId] = useState<string | null>(null);
  const [editCustom, setEditCustom] = useState({ name: "", key: "", type: "TEXT", optionsRaw: "" });
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState({ name: "", email: "", role: "READ", isActive: true, password: "" });

  async function load() {
    const [d, c, t, l, f, cfg, u, tokens, meta] = await Promise.all([
      fetch("/api/admin/dash", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/categories", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/tags", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/locations", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/custom-fields", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/label-config", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/users", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/api-tokens", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/meta", { cache: "no-store" }).then((r) => r.json())
    ]);
    setDash(d);
    setCategories(c);
    setTags(t);
    setLocations(l);
    setCustomFields(f);
    setLabelConfig(cfg);
    setUsers(u);
    setApiTokens(tokens);
    setAreas(meta.areas || []);
    setTypes(meta.types || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function apiJson(url: string, init: RequestInit) {
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      return { res, data };
    } catch (error) {
      return {
        res: { ok: false, status: 0 } as Response,
        data: { error: (error as Error).message || "Netzwerkfehler" }
      };
    }
  }

  function startEdit<T extends IdObj>(row: T, kind: "category" | "tag" | "location" | "custom" | "user") {
    if (kind === "category") {
      setEditCategoryId(row.id);
      setEditCategoryName((row as any).name || "");
    }
    if (kind === "tag") {
      setEditTagId(row.id);
      setEditTagName((row as any).name || "");
    }
    if (kind === "location") {
      setEditLocationId(row.id);
      setEditLocationName((row as any).name || "");
      setEditLocationCode((row as any).code || "");
    }
    if (kind === "custom") {
      let optionsRaw = "";
      try {
        const parsed = (row as any).options ? JSON.parse((row as any).options) : [];
        optionsRaw = Array.isArray(parsed) ? parsed.join("|") : String(parsed || "");
      } catch {
        optionsRaw = (row as any).options || "";
      }
      setEditCustomId(row.id);
      setEditCustom({
        name: (row as any).name || "",
        key: (row as any).key || "",
        type: (row as any).type || "TEXT",
        optionsRaw
      });
    }
    if (kind === "user") {
      setEditUserId(row.id);
      setEditUser({
        name: (row as any).name || "",
        email: (row as any).email || "",
        role: (row as any).role || "READ",
        isActive: !!(row as any).isActive,
        password: ""
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <Link className="btn-secondary" href="/admin/audit">
          Audit History
        </Link>
      </div>
      {feedback && <div className="rounded border border-workshop-300 bg-workshop-100 p-2 text-sm">{feedback}</div>}

      {dash && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="card"><p className="text-xs">Items</p><p className="text-2xl font-bold">{dash.items}</p></div>
          <div className="card"><p className="text-xs">Unter min</p><p className="text-2xl font-bold">{dash.lowStock}</p></div>
          <div className="card"><p className="text-xs">Nutzer</p><p className="text-2xl font-bold">{dash.users}</p></div>
          <div className="card"><p className="text-xs">Lagerorte</p><p className="text-2xl font-bold">{dash.locations}</p></div>
          <div className="card"><p className="text-xs">Letztes Backup</p><p className="text-xs break-all">{dash.latestBackup || "keins"}</p></div>
        </div>
      )}

      <div className="card flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          className="btn"
          onClick={async () => {
            const { res, data } = await apiJson("/api/backup/create", { method: "POST" });
            setBackupResult(data);
            setFeedback(res.ok ? "Backup erstellt" : `Backup fehlgeschlagen: ${data.error || "Unbekannt"}`);
            await load();
          }}
        >
          Backup jetzt
        </button>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const { res, data } = await apiJson("/api/backup/restore", { method: "POST", body: form });
            setRestoreResult(data);
            setFeedback(
              res.ok
                ? data.dryRun
                  ? "Restore-Vorschau aktualisiert"
                  : "Restore ausgefuehrt"
                : `Restore Fehler: ${data.error || "Unbekannt"}`
            );
            if (res.ok && !data.dryRun) {
              await load();
            }
          }}
          className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <input className="input" type="file" name="file" accept=".zip" required />
          <select className="input" name="strategy"><option value="merge">merge</option><option value="overwrite">overwrite</option></select>
          <select className="input" name="dryRun"><option value="1">Preview</option><option value="0">Apply</option></select>
          <button className="btn-secondary w-full sm:w-auto" type="submit">Restore ZIP</button>
        </form>
      </div>

      {backupResult?.backupFile && (
        <div className="card text-sm">
          <p className="font-semibold">Letztes Backup</p>
          <p className="break-all">{backupResult.backupFile}</p>
          <p>ZIP SHA-256: <span className="font-mono text-xs">{backupResult.zipSha256}</span></p>
          <p>
            Inhalt: {backupResult.manifest?.itemCount || 0} Items, {backupResult.manifest?.bomCount || 0} BOM-Eintraege,
            {" "}{backupResult.manifest?.auditCount || 0} Audit-Logs
          </p>
          <p>Retention geloeschter Dateien: {(backupResult.deletedBackups || []).join(", ") || "-"}</p>
        </div>
      )}

      {restoreResult?.conflicts && (
        <div className="card text-sm">
          <p className="font-semibold">{restoreResult.dryRun ? "Restore Vorschau" : "Restore Ergebnis"}</p>
          {restoreResult.manifest && (
            <p>
              Manifest: {restoreResult.manifest.itemCount || 0} Items, {restoreResult.manifest.bomCount || 0} BOM,
              {" "}{restoreResult.manifest.auditCount || 0} Audit-Logs, Checksumme: {restoreResult.checksumVerified ? "ok" : "nicht vorhanden"}
            </p>
          )}
          {restoreResult.summary && (
            <p>
              Preview: {restoreResult.summary.items} Items, {restoreResult.summary.boms} BOM, {restoreResult.summary.auditLogs} Audit-Logs
            </p>
          )}
          {!restoreResult.dryRun && (
            <p>
              Wiederhergestellt: {restoreResult.restoredItems || 0} Items, {restoreResult.restoredBomEntries || 0} BOM,
              {" "}{restoreResult.restoredAuditLogs || 0} Audit-Logs
            </p>
          )}
          <p>Kategorien: {(restoreResult.conflicts.categories || []).join(", ") || "-"}</p>
          <p>Lagerorte: {(restoreResult.conflicts.locations || []).join(", ") || "-"}</p>
          <p>Tags: {(restoreResult.conflicts.tags || []).join(", ") || "-"}</p>
          <p>Items (labelCode): {(restoreResult.conflicts.items || []).join(", ") || "-"}</p>
          <p>Areas: {(restoreResult.conflicts.areas || []).join(", ") || "-"}</p>
          <p>Types: {(restoreResult.conflicts.types || []).join(", ") || "-"}</p>
        </div>
      )}

      <section className="card space-y-2">
        <h2 className="font-semibold">CSV Import (Dry-run + Apply)</h2>
        <form
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const { data } = await apiJson("/api/import", { method: "POST", body: form });
            setImportResult(data);
          }}
        >
          <input className="input sm:col-span-2 xl:col-span-2" type="file" name="file" accept=".csv,text/csv" required />
          <select className="input" name="areaId" required>
            <option value="">Area</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.code} - {area.name}
              </option>
            ))}
          </select>
          <select className="input" name="typeId" required>
            <option value="">Type</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.code} - {type.name}
              </option>
            ))}
          </select>
          <select className="input" name="dryRun"><option value="1">Dry-run</option><option value="0">Apply</option></select>
          <button className="btn sm:col-span-2 xl:col-span-2">Import starten</button>
        </form>
        {importResult && (
          <div className="space-y-2 rounded border border-workshop-200 p-2 text-sm">
            <p>
              Rows: {importResult.totalRows} | Created: {importResult.created} | DryRun: {String(importResult.dryRun)}
              {" "} | Errors: {importResult.errorsCount || 0} | Warnings: {importResult.warningsCount || 0}
            </p>
            {!!importResult.createdItems?.length && (
              <p>
                Angelegt: {importResult.createdItems.map((item: any) => `${item.labelCode} (${item.name})`).join(", ")}
              </p>
            )}
            <div className="space-y-2">
              {(importResult.rows || []).slice(0, 20).map((row: any) => (
                <div
                  key={row.lineNumber}
                  className={`rounded border px-3 py-2 ${row.status === "ready" ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}
                >
                  <p className="font-medium">
                    Zeile {row.lineNumber} - {row.status === "ready" ? "bereit" : "fehlerhaft"}
                  </p>
                  {row.input && (
                    <p>
                      {row.input.name} | {row.input.categoryName} | {row.input.locationName}
                    </p>
                  )}
                  {!!row.errors?.length && <p className="text-red-700">Fehler: {row.errors.join(" | ")}</p>}
                  {!!row.warnings?.length && <p className="text-amber-700">Warnungen: {row.warnings.join(" | ")}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card space-y-2">
          <h2 className="font-semibold">Kategorien</h2>
          <ul className="space-y-1 text-sm">
            {categories.map((c) => (
              <li key={c.id} className="rounded border border-workshop-200 p-2">
                {editCategoryId === c.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input className="input" value={editCategoryName} onChange={(e) => setEditCategoryName(e.target.value)} />
                    <button className="btn-secondary px-2" onClick={async () => {
                      const { res, data } = await apiJson("/api/admin/categories", {
                        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: c.id, name: editCategoryName })
                      });
                      setFeedback(res.ok ? "Kategorie aktualisiert" : `Kategorie-Update fehlgeschlagen: ${data.error || "Unbekannt"}`);
                      setEditCategoryId(null);
                      await load();
                    }}>Speichern</button>
                    <button className="btn-secondary px-2" onClick={() => setEditCategoryId(null)}>Abbrechen</button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="break-words">{c.name}</span>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button className="btn-secondary px-2 py-1" onClick={() => startEdit(c, "category")}>Bearbeiten</button>
                      <button className="btn-secondary px-2 py-1" onClick={async () => {
                        const { res, data } = await apiJson("/api/admin/categories", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: c.id }) });
                        setFeedback(res.ok ? "Kategorie geloescht" : `Kategorie-Loeschen fehlgeschlagen: ${data.error || "Unbekannt"}`);
                        await load();
                      }}>Loeschen</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const { res, data } = await apiJson("/api/admin/categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: fd.get("name") }) });
            setFeedback(res.ok ? "Kategorie angelegt" : `Kategorie anlegen fehlgeschlagen: ${data.error || "Unbekannt"}`);
            e.currentTarget.reset();
            await load();
          }}>
            <input className="input" name="name" placeholder="Neue Kategorie" required />
            <button className="btn-secondary" type="submit">Anlegen</button>
          </form>
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold">Tags</h2>
          <ul className="space-y-1 text-sm">
            {tags.map((t) => (
              <li key={t.id} className="rounded border border-workshop-200 p-2">
                {editTagId === t.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input className="input" value={editTagName} onChange={(e) => setEditTagName(e.target.value)} />
                    <button className="btn-secondary px-2" onClick={async () => {
                      const { res, data } = await apiJson("/api/admin/tags", {
                        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: t.id, name: editTagName })
                      });
                      setFeedback(res.ok ? "Tag aktualisiert" : `Tag-Update fehlgeschlagen: ${data.error || "Unbekannt"}`);
                      setEditTagId(null);
                      await load();
                    }}>Speichern</button>
                    <button className="btn-secondary px-2" onClick={() => setEditTagId(null)}>Abbrechen</button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="break-words">{t.name}</span>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button className="btn-secondary px-2 py-1" onClick={() => startEdit(t, "tag")}>Bearbeiten</button>
                      <button className="btn-secondary px-2 py-1" onClick={async () => {
                        const { res, data } = await apiJson("/api/admin/tags", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: t.id }) });
                        setFeedback(res.ok ? "Tag geloescht" : `Tag-Loeschen fehlgeschlagen: ${data.error || "Unbekannt"}`);
                        await load();
                      }}>Loeschen</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const { res, data } = await apiJson("/api/admin/tags", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: fd.get("name") }) });
            setFeedback(res.ok ? "Tag angelegt" : `Tag anlegen fehlgeschlagen: ${data.error || "Unbekannt"}`);
            e.currentTarget.reset();
            await load();
          }}>
            <input className="input" name="name" placeholder="Neuer Tag" required />
            <button className="btn-secondary" type="submit">Anlegen</button>
          </form>
        </section>
      </div>

      <section className="card space-y-2">
        <h2 className="font-semibold">Read-only API Tokens</h2>
        {newTokenValue && <div className="rounded border border-green-600 bg-green-50 p-2 text-sm">Neuer Token (nur jetzt sichtbar): <code className="break-all">{newTokenValue}</code></div>}
        <ul className="space-y-1 text-sm">
          {apiTokens.map((t) => (
            <li key={t.id} className="rounded border border-workshop-200 p-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="break-words">{t.name} | {t.user?.email || t.userId} | aktiv: {String(t.isActive)}</span>
                {t.isActive && <button className="btn-secondary px-2 py-1" onClick={async () => {
                  await fetch(`/api/admin/api-tokens/${t.id}`, { method: "DELETE" });
                  setFeedback("API Token deaktiviert");
                  await load();
                }}>deaktivieren</button>}
              </div>
            </li>
          ))}
        </ul>
        <form className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const { res, data } = await apiJson("/api/admin/api-tokens", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: fd.get("name"), userId: fd.get("userId") || undefined, expiresAt: fd.get("expiresAt") || undefined })
          });
          setNewTokenValue(data.token || "");
          setFeedback(res.ok ? "API Token erstellt" : `Token erstellen fehlgeschlagen: ${data.error || "Unbekannt"}`);
          e.currentTarget.reset();
          await load();
        }}>
          <input className="input" name="name" placeholder="Token Name" required />
          <select className="input" name="userId"><option value="">aktueller Admin</option>{users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}</select>
          <input className="input" name="expiresAt" type="datetime-local" />
          <button className="btn-secondary">Token erstellen</button>
        </form>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Nutzerverwaltung</h2>
        <ul className="space-y-1 text-sm">
          {users.map((u) => (
            <li key={u.id} className="rounded border border-workshop-200 p-2">
              {editUserId === u.id ? (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                  <input className="input" value={editUser.name} onChange={(e) => setEditUser((v) => ({ ...v, name: e.target.value }))} />
                  <input className="input" value={editUser.email} onChange={(e) => setEditUser((v) => ({ ...v, email: e.target.value }))} />
                  <select className="input" value={editUser.role} onChange={(e) => setEditUser((v) => ({ ...v, role: e.target.value }))}>
                    <option value="READ">READ</option><option value="READ_WRITE">READ_WRITE</option><option value="ADMIN">ADMIN</option>
                  </select>
                  <label className="text-sm"><input type="checkbox" checked={editUser.isActive} onChange={(e) => setEditUser((v) => ({ ...v, isActive: e.target.checked }))} /> aktiv</label>
                  <input className="input" value={editUser.password} onChange={(e) => setEditUser((v) => ({ ...v, password: e.target.value }))} placeholder="Neues Passwort (optional)" />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button className="btn-secondary px-2" onClick={async () => {
                      const payload: any = { id: u.id, name: editUser.name, email: editUser.email, role: editUser.role, isActive: editUser.isActive };
                      if (editUser.password) payload.password = editUser.password;
                      const { res, data } = await apiJson("/api/admin/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
                      setFeedback(res.ok ? "Nutzer aktualisiert" : `Nutzer-Update fehlgeschlagen: ${data.error || "Unbekannt"}`);
                      setEditUserId(null);
                      await load();
                    }}>Speichern</button>
                    <button className="btn-secondary px-2" onClick={() => setEditUserId(null)}>Abbrechen</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="break-words">{u.name} ({u.email}) - {u.role} - aktiv: {String(u.isActive)}</span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button className="btn-secondary px-2 py-1" onClick={() => startEdit(u, "user")}>Bearbeiten</button>
                    <button className="btn-secondary px-2 py-1" onClick={async () => {
                      const { res, data } = await apiJson("/api/admin/users", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: u.id }) });
                      setFeedback(res.ok ? "Nutzer deaktiviert" : `Nutzer deaktivieren fehlgeschlagen: ${data.error || "Unbekannt"}`);
                      await load();
                    }}>Deaktivieren</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <form className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const { res, data } = await apiJson("/api/admin/users", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password"), role: fd.get("role") })
          });
          if (!res.ok) {
            setFeedback(`Nutzer anlegen fehlgeschlagen: ${data.error || "Unbekannt"}`);
            return;
          }
          setFeedback("Nutzer angelegt");
          e.currentTarget.reset();
          await load();
        }}>
          <input className="input" name="name" placeholder="Name" required />
          <input className="input" name="email" placeholder="E-Mail" required />
          <input className="input" name="password" placeholder="Passwort (mind. 8 Zeichen)" minLength={8} required />
          <select className="input" name="role"><option value="READ">READ</option><option value="READ_WRITE">READ_WRITE</option><option value="ADMIN">ADMIN</option></select>
          <button className="btn-secondary" type="submit">Nutzer anlegen</button>
        </form>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card space-y-2">
          <h2 className="font-semibold">Lagerorte</h2>
          <ul className="space-y-1 text-sm">
            {locations.map((l) => (
              <li key={l.id} className="rounded border border-workshop-200 p-2">
                {editLocationId === l.id ? (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <input className="input" value={editLocationName} onChange={(e) => setEditLocationName(e.target.value)} />
                    <input className="input" value={editLocationCode} onChange={(e) => setEditLocationCode(e.target.value)} />
                    <button className="btn-secondary" onClick={async () => {
                      const { res, data } = await apiJson("/api/admin/locations", {
                        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: l.id, name: editLocationName, code: editLocationCode })
                      });
                      setFeedback(res.ok ? "Lagerort aktualisiert" : `Lagerort-Update fehlgeschlagen: ${data.error || "Unbekannt"}`);
                      setEditLocationId(null);
                      await load();
                    }}>Speichern</button>
                    <button className="btn-secondary" onClick={() => setEditLocationId(null)}>Abbrechen</button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="break-words">{l.name} ({l.code})</span>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button className="btn-secondary px-2 py-1" onClick={() => startEdit(l, "location")}>Bearbeiten</button>
                      <button className="btn-secondary px-2 py-1" onClick={async () => {
                        const { res, data } = await apiJson("/api/admin/locations", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: l.id }) });
                        setFeedback(res.ok ? "Lagerort geloescht" : `Lagerort-Loeschen fehlgeschlagen: ${data.error || "Unbekannt"}`);
                        await load();
                      }}>Loeschen</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <form className="grid gap-2 sm:grid-cols-3" onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const { res, data } = await apiJson("/api/admin/locations", {
              method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: fd.get("name"), code: fd.get("code") })
            });
            setFeedback(res.ok ? "Lagerort angelegt" : `Lagerort anlegen fehlgeschlagen: ${data.error || "Unbekannt"}`);
            e.currentTarget.reset();
            await load();
          }}>
            <input className="input" name="name" placeholder="Name" required />
            <input className="input" name="code" placeholder="Code" />
            <button className="btn-secondary" type="submit">Anlegen</button>
          </form>
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold">Custom Fields</h2>
          <ul className="space-y-1 text-sm">
            {customFields.map((f) => (
              <li key={f.id} className="rounded border border-workshop-200 p-2">
                {editCustomId === f.id ? (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    <input className="input" value={editCustom.name} onChange={(e) => setEditCustom((v) => ({ ...v, name: e.target.value }))} />
                    <input className="input" value={editCustom.key} onChange={(e) => setEditCustom((v) => ({ ...v, key: e.target.value }))} />
                    <select className="input" value={editCustom.type} onChange={(e) => setEditCustom((v) => ({ ...v, type: e.target.value }))}>
                      <option>TEXT</option><option>NUMBER</option><option>BOOLEAN</option><option>SELECT</option><option>MULTI_SELECT</option><option>DATE</option>
                    </select>
                    <input className="input" value={editCustom.optionsRaw} onChange={(e) => setEditCustom((v) => ({ ...v, optionsRaw: e.target.value }))} placeholder="opt1|opt2" />
                    <div className="flex flex-col gap-2 sm:flex-row sm:col-span-2 xl:col-span-1">
                      <button className="btn-secondary" onClick={async () => {
                        const options = editCustom.optionsRaw ? editCustom.optionsRaw.split("|") : null;
                        const { res, data } = await apiJson("/api/admin/custom-fields", {
                          method: "PATCH", headers: { "content-type": "application/json" },
                          body: JSON.stringify({ id: f.id, name: editCustom.name, key: editCustom.key, type: editCustom.type, options })
                        });
                        setFeedback(res.ok ? "Custom Field aktualisiert" : `Custom Field Update fehlgeschlagen: ${data.error || "Unbekannt"}`);
                        setEditCustomId(null);
                        await load();
                      }}>Speichern</button>
                      <button className="btn-secondary" onClick={() => setEditCustomId(null)}>Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="break-words">{f.name} ({f.type}) {f.key}</span>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button className="btn-secondary px-2 py-1" onClick={() => startEdit(f, "custom")}>Bearbeiten</button>
                      <button className="btn-secondary px-2 py-1" onClick={async () => {
                        const { res, data } = await apiJson("/api/admin/custom-fields", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: f.id }) });
                        setFeedback(res.ok ? "Custom Field geloescht" : `Custom Field Loeschen fehlgeschlagen: ${data.error || "Unbekannt"}`);
                        await load();
                      }}>Loeschen</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <form className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const { res, data } = await apiJson("/api/admin/custom-fields", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ name: fd.get("name"), key: fd.get("key"), type: fd.get("type"), options: fd.get("options") ? String(fd.get("options")).split("|") : null })
            });
            setFeedback(res.ok ? "Custom Field angelegt" : `Custom Field anlegen fehlgeschlagen: ${data.error || "Unbekannt"}`);
            e.currentTarget.reset();
            await load();
          }}>
            <input className="input" name="name" placeholder="Name" required />
            <input className="input" name="key" placeholder="key" required />
            <select className="input" name="type"><option>TEXT</option><option>NUMBER</option><option>BOOLEAN</option><option>SELECT</option><option>MULTI_SELECT</option><option>DATE</option></select>
            <input className="input sm:col-span-2 xl:col-span-2" name="options" placeholder="option1|option2|option3" />
            <button className="btn-secondary" type="submit">Anlegen</button>
          </form>
        </section>
      </div>

      {labelConfig && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Label-Code Einstellungen</h2>
          <form className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await fetch("/api/admin/label-config", {
              method: "PATCH", headers: { "content-type": "application/json" },
              body: JSON.stringify({
                separator: fd.get("separator"), digits: Number(fd.get("digits")), prefix: fd.get("prefix"), suffix: fd.get("suffix"),
                delimiter: fd.get("delimiter"), regenerateOnType: !!fd.get("regenerateOnType")
              })
            });
            await load();
          }}>
            <input className="input" name="separator" defaultValue={labelConfig.separator} placeholder="-" />
            <input className="input" name="digits" type="number" min={2} max={6} defaultValue={labelConfig.digits} />
            <input className="input" name="prefix" defaultValue={labelConfig.prefix || ""} placeholder="Prefix" />
            <input className="input" name="suffix" defaultValue={labelConfig.suffix || ""} placeholder="Suffix" />
            <input className="input" name="delimiter" defaultValue={labelConfig.delimiter || ";"} placeholder="CSV Delimiter" />
            <label className="text-sm sm:col-span-2 xl:col-span-1"><input type="checkbox" name="regenerateOnType" defaultChecked={labelConfig.regenerateOnType} /> Neuen Code bei Area/Type Aenderung</label>
            <button className="btn sm:col-span-2 xl:col-span-2">Speichern</button>
          </form>
        </section>
      )}
    </div>
  );
}
