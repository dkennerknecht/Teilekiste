"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PencilLine, Trash2 } from "lucide-react";
import type { CustomFieldRow } from "@/lib/custom-fields";

type IdObj = { id: string };
type LocationRow = { id: string; name: string; code?: string | null };
type ShelfRow = {
  id: string;
  name: string;
  storageLocationId: string;
  storageLocation?: LocationRow | null;
};
type CustomFieldFormState = {
  name: string;
  type: string;
  unit: string;
  optionsRaw: string;
  categoryId: string;
  typeId: string;
  required: boolean;
};

function IconActionButton({
  label,
  onClick,
  children
}: {
  label: string;
  onClick: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="btn-secondary flex h-11 w-11 shrink-0 items-center justify-center px-0 py-0"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function formatAdminBackupStat(latestBackup: string | null) {
  if (!latestBackup) return "kein";
  const fileName = latestBackup.split("/").pop() || latestBackup;
  return fileName.replace(/^backup-/, "").replace(/\.zip$/, "");
}

export default function AdminPage() {
  const [dash, setDash] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [apiTokens, setApiTokens] = useState<any[]>([]);
  const [newTokenValue, setNewTokenValue] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [shelves, setShelves] = useState<ShelfRow[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([]);
  const [labelConfig, setLabelConfig] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [backupResult, setBackupResult] = useState<any>(null);
  const [types, setTypes] = useState<any[]>([]);

  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryCode, setEditCategoryCode] = useState("");
  const [editTypeId, setEditTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [editTypeCode, setEditTypeCode] = useState("");
  const [editTagId, setEditTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editLocationId, setEditLocationId] = useState<string | null>(null);
  const [editLocationName, setEditLocationName] = useState("");
  const [editLocationCode, setEditLocationCode] = useState("");
  const [editShelfId, setEditShelfId] = useState<string | null>(null);
  const [editShelfName, setEditShelfName] = useState("");
  const [editShelfLocationId, setEditShelfLocationId] = useState("");
  const [editCustomId, setEditCustomId] = useState<string | null>(null);
  const [editCustom, setEditCustom] = useState<CustomFieldFormState>({
    name: "",
    type: "TEXT",
    unit: "",
    optionsRaw: "",
    categoryId: "",
    typeId: "",
    required: false
  });
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState({ name: "", email: "", role: "READ", isActive: true, password: "" });
  const [newShelfLocationId, setNewShelfLocationId] = useState("");

  async function load() {
    const [d, c, t, ty, l, sh, f, cfg, u, tokens] = await Promise.all([
      fetch("/api/admin/dash", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/categories", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/tags", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/types", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/locations", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/shelves", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/custom-fields", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/label-config", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/users", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/api-tokens", { cache: "no-store" }).then((r) => r.json())
    ]);
    setDash(d);
    setCategories(c);
    setTags(t);
    setTypes(ty);
    setLocations(l);
    setShelves(sh);
    setCustomFields(f);
    setLabelConfig(cfg);
    setUsers(u);
    setApiTokens(tokens);
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

  function sortByName<T extends { name?: string | null }>(rows: T[]) {
    return [...rows].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }

  function sortByCodeThenName<T extends { code?: string | null; name?: string | null }>(rows: T[]) {
    return [...rows].sort(
      (a, b) =>
        String(a.code || "").localeCompare(String(b.code || "")) || String(a.name || "").localeCompare(String(b.name || ""))
    );
  }

  function sortShelves<T extends ShelfRow>(rows: T[]) {
    return [...rows].sort(
      (a, b) =>
        String(a.storageLocation?.name || "").localeCompare(String(b.storageLocation?.name || "")) ||
        String(a.name || "").localeCompare(String(b.name || ""))
    );
  }

  function describeCustomFieldScope(field: CustomFieldRow) {
    if (field.category && field.labelType) {
      return `${field.category.name} / ${field.labelType.code} - ${field.labelType.name}`;
    }
    if (field.category) return field.category.name;
    if (field.labelType) return `${field.labelType.code} - ${field.labelType.name}`;
    return "Alle Items";
  }

  function replaceById<T extends IdObj>(rows: T[], nextRow: T) {
    return rows.map((row) => (row.id === nextRow.id ? { ...row, ...nextRow } : row));
  }

  function removeById<T extends IdObj>(rows: T[], id: string) {
    return rows.filter((row) => row.id !== id);
  }

  function startEdit<T extends IdObj>(row: T, kind: "category" | "type" | "tag" | "location" | "shelf" | "custom" | "user") {
    if (kind === "category") {
      setEditCategoryId(row.id);
      setEditCategoryName((row as any).name || "");
      setEditCategoryCode((row as any).code || "");
    }
    if (kind === "type") {
      setEditTypeId(row.id);
      setEditTypeName((row as any).name || "");
      setEditTypeCode((row as any).code || "");
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
    if (kind === "shelf") {
      setEditShelfId(row.id);
      setEditShelfName((row as any).name || "");
      setEditShelfLocationId((row as any).storageLocationId || "");
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
        type: (row as any).type || "TEXT",
        unit: (row as any).unit || "",
        optionsRaw,
        categoryId: (row as any).categoryId || "",
        typeId: (row as any).typeId || "",
        required: !!(row as any).required
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

  useEffect(() => {
    if (!locations.length) {
      setNewShelfLocationId("");
      return;
    }
    if (!locations.some((location) => location.id === newShelfLocationId)) {
      setNewShelfLocationId(locations[0].id);
    }
  }, [locations, newShelfLocationId]);

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
        <div className="grid grid-cols-5 gap-1 sm:gap-3">
          <div className="card min-w-0 px-1.5 py-2 text-center sm:px-3">
            <p className="text-[10px] leading-tight sm:text-xs">Items</p>
            <p className="text-base font-bold leading-tight sm:text-2xl">{dash.items}</p>
          </div>
          <div className="card min-w-0 px-1.5 py-2 text-center sm:px-3">
            <p className="text-[10px] leading-tight sm:text-xs">Unter min</p>
            <p className="text-base font-bold leading-tight sm:text-2xl">{dash.lowStock}</p>
          </div>
          <div className="card min-w-0 px-1.5 py-2 text-center sm:px-3">
            <p className="text-[10px] leading-tight sm:text-xs">Nutzer</p>
            <p className="text-base font-bold leading-tight sm:text-2xl">{dash.users}</p>
          </div>
          <div className="card min-w-0 px-1.5 py-2 text-center sm:px-3">
            <p className="text-[10px] leading-tight sm:text-xs">Orte</p>
            <p className="text-base font-bold leading-tight sm:text-2xl">{dash.locations}</p>
          </div>
          <div className="card min-w-0 px-1.5 py-2 text-center sm:px-3" title={dash.latestBackup || "keins"}>
            <p className="text-[10px] leading-tight sm:text-xs">Backup</p>
            <p className="truncate text-[10px] leading-tight sm:text-xs">{formatAdminBackupStat(dash.latestBackup)}</p>
          </div>
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
          <p>Regale: {(restoreResult.conflicts.shelves || []).join(", ") || "-"}</p>
          <p>Tags: {(restoreResult.conflicts.tags || []).join(", ") || "-"}</p>
          <p>Items (labelCode): {(restoreResult.conflicts.items || []).join(", ") || "-"}</p>
          <p>Areas: {(restoreResult.conflicts.areas || []).join(", ") || "-"}</p>
          <p>Types: {(restoreResult.conflicts.types || []).join(", ") || "-"}</p>
        </div>
      )}

      <section className="card space-y-2">
        <h2 className="font-semibold">CSV Import (Dry-run + Apply)</h2>
        <p className="text-sm text-workshop-700">Die Kategorie kommt aus jeder CSV-Zeile. Hier waehlt man nur den Type fuer die ID-Vergabe.</p>
        <form
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const { data } = await apiJson("/api/import", { method: "POST", body: form });
            setImportResult(data);
          }}
        >
          <input className="input sm:col-span-2" type="file" name="file" accept=".csv,text/csv" required />
          <select className="input" name="typeId" required>
            <option value="">Type</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.code} - {type.name}
              </option>
            ))}
          </select>
          <select className="input" name="dryRun"><option value="1">Dry-run</option><option value="0">Apply</option></select>
          <button className="btn sm:col-span-2">Import starten</button>
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

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="card space-y-2">
          <h2 className="font-semibold">Kategorien</h2>
          <ul className="space-y-1 text-sm">
            {categories.map((c) => (
              <li key={c.id} className="rounded border border-workshop-200 p-2">
                {editCategoryId === c.id ? (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto_auto]">
                    <input className="input" value={editCategoryName} onChange={(e) => setEditCategoryName(e.target.value)} />
                    <input className="input" value={editCategoryCode} onChange={(e) => setEditCategoryCode(e.target.value.toUpperCase())} maxLength={2} />
                    <button className="btn-secondary px-2" onClick={async () => {
                      const { res, data } = await apiJson("/api/admin/categories", {
                        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: c.id, name: editCategoryName, code: editCategoryCode })
                      });
                      setFeedback(res.ok ? "Kategorie aktualisiert" : `Kategorie-Update fehlgeschlagen: ${data.error || "Unbekannt"}`);
                      if (res.ok) {
                        setCategories((prev) => sortByName(replaceById(prev, data)));
                        setEditCategoryId(null);
                        setEditCategoryName("");
                        setEditCategoryCode("");
                      }
                    }}>Speichern</button>
                    <button className="btn-secondary px-2" onClick={() => setEditCategoryId(null)}>Abbrechen</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate whitespace-nowrap" title={`${c.name} (${c.code || "--"})`}>
                      {c.name} ({c.code || "--"})
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconActionButton label="Kategorie bearbeiten" onClick={() => startEdit(c, "category")}>
                        <PencilLine size={20} />
                      </IconActionButton>
                      <IconActionButton
                        label="Kategorie loeschen"
                        onClick={async () => {
                          const { res, data } = await apiJson("/api/admin/categories", {
                            method: "DELETE",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: c.id })
                          });
                          setFeedback(res.ok ? "Kategorie geloescht" : `Kategorie-Loeschen fehlgeschlagen: ${data.error || "Unbekannt"}`);
                          if (res.ok) setCategories((prev) => removeById(prev, c.id));
                        }}
                      >
                        <Trash2 size={20} />
                      </IconActionButton>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <form className="grid grid-cols-[minmax(0,4fr)_minmax(0,1fr)] gap-2" onSubmit={async (e) => {
            e.preventDefault();
            const formEl = e.currentTarget;
            const fd = new FormData(formEl);
            const { res, data } = await apiJson("/api/admin/categories", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name: fd.get("name"), code: String(fd.get("code") || "").toUpperCase() })
            });
            setFeedback(res.ok ? "Kategorie angelegt" : `Kategorie anlegen fehlgeschlagen: ${data.error || "Unbekannt"}`);
            if (res.ok) {
              setCategories((prev) => sortByName([...prev, data]));
              formEl.reset();
            }
          }}>
            <input className="input min-w-0" name="name" placeholder="Neue Kategorie" required />
            <input className="input min-w-0" name="code" placeholder="Code" maxLength={2} required />
            <button className="btn-secondary col-span-2" type="submit">Anlegen</button>
          </form>
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold">Types</h2>
          <ul className="space-y-1 text-sm">
            {types.map((type) => (
              <li key={type.id} className="rounded border border-workshop-200 p-2">
                {editTypeId === type.id ? (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto_auto]">
                    <input className="input" value={editTypeName} onChange={(e) => setEditTypeName(e.target.value)} />
                    <input className="input" value={editTypeCode} onChange={(e) => setEditTypeCode(e.target.value.toUpperCase())} maxLength={2} />
                    <button
                      className="btn-secondary px-2"
                      onClick={async () => {
                        const { res, data } = await apiJson("/api/admin/types", {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ id: type.id, name: editTypeName, code: editTypeCode })
                        });
                        setFeedback(res.ok ? "Type aktualisiert" : `Type-Update fehlgeschlagen: ${data.error || "Unbekannt"}`);
                        if (res.ok) {
                          setTypes((prev) => sortByCodeThenName(replaceById(prev, data)));
                          setEditTypeId(null);
                          setEditTypeName("");
                          setEditTypeCode("");
                        }
                      }}
                    >
                      Speichern
                    </button>
                    <button className="btn-secondary px-2" onClick={() => setEditTypeId(null)}>Abbrechen</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate whitespace-nowrap" title={`${type.name} (${type.code || "--"})`}>
                      {type.name} ({type.code || "--"})
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconActionButton label="Type bearbeiten" onClick={() => startEdit(type, "type")}>
                        <PencilLine size={20} />
                      </IconActionButton>
                      <IconActionButton
                        label="Type loeschen"
                        onClick={async () => {
                          const { res, data } = await apiJson("/api/admin/types", {
                            method: "DELETE",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: type.id })
                          });
                          setFeedback(res.ok ? "Type geloescht" : `Type-Loeschen fehlgeschlagen: ${data.error || "Unbekannt"}`);
                          if (res.ok) setTypes((prev) => removeById(prev, type.id));
                        }}
                      >
                        <Trash2 size={20} />
                      </IconActionButton>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <form
            className="grid grid-cols-[minmax(0,4fr)_minmax(0,1fr)] gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const fd = new FormData(formEl);
              const { res, data } = await apiJson("/api/admin/types", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ name: fd.get("name"), code: String(fd.get("code") || "").toUpperCase() })
              });
              setFeedback(res.ok ? "Type angelegt" : `Type anlegen fehlgeschlagen: ${data.error || "Unbekannt"}`);
              if (res.ok) {
                setTypes((prev) => sortByCodeThenName([...prev, data]));
                formEl.reset();
              }
            }}
          >
            <input className="input min-w-0" name="name" placeholder="Neuer Type" required />
            <input className="input min-w-0" name="code" placeholder="Code" maxLength={2} required />
            <button className="btn-secondary col-span-2" type="submit">Anlegen</button>
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
                      if (res.ok) {
                        setTags((prev) => sortByName(replaceById(prev, data)));
                        setEditTagId(null);
                        setEditTagName("");
                      }
                    }}>Speichern</button>
                    <button className="btn-secondary px-2" onClick={() => setEditTagId(null)}>Abbrechen</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate whitespace-nowrap" title={t.name}>
                      {t.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconActionButton label="Tag bearbeiten" onClick={() => startEdit(t, "tag")}>
                        <PencilLine size={20} />
                      </IconActionButton>
                      <IconActionButton
                        label="Tag loeschen"
                        onClick={async () => {
                          const { res, data } = await apiJson("/api/admin/tags", {
                            method: "DELETE",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: t.id })
                          });
                          setFeedback(res.ok ? "Tag geloescht" : `Tag-Loeschen fehlgeschlagen: ${data.error || "Unbekannt"}`);
                          if (res.ok) setTags((prev) => removeById(prev, t.id));
                        }}
                      >
                        <Trash2 size={20} />
                      </IconActionButton>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async (e) => {
            e.preventDefault();
            const formEl = e.currentTarget;
            const fd = new FormData(formEl);
            const { res, data } = await apiJson("/api/admin/tags", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: fd.get("name") }) });
            setFeedback(res.ok ? "Tag angelegt" : `Tag anlegen fehlgeschlagen: ${data.error || "Unbekannt"}`);
            if (res.ok) {
              setTags((prev) => sortByName([...prev, data]));
              formEl.reset();
            }
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
                      if (res.ok) {
                        setUsers((prev) => replaceById(prev, data));
                        setEditUserId(null);
                        setEditUser({ name: "", email: "", role: "READ", isActive: true, password: "" });
                      }
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
                      if (res.ok) {
                        setUsers((prev) => prev.map((row) => (row.id === u.id ? { ...row, isActive: false } : row)));
                      }
                    }}>Deaktivieren</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <form className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" onSubmit={async (e) => {
          e.preventDefault();
          const formEl = e.currentTarget;
          const fd = new FormData(formEl);
          const { res, data } = await apiJson("/api/admin/users", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password"), role: fd.get("role") })
          });
          if (!res.ok) {
            setFeedback(`Nutzer anlegen fehlgeschlagen: ${data.error || "Unbekannt"}`);
            return;
          }
          setFeedback("Nutzer angelegt");
          setUsers((prev) => [data, ...prev]);
          setDash((prev: any) => (prev ? { ...prev, users: prev.users + 1 } : prev));
          formEl.reset();
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
                      if (res.ok) {
                        setLocations((prev) => sortByName(replaceById(prev, data)));
                        setEditLocationId(null);
                        setEditLocationName("");
                        setEditLocationCode("");
                      }
                    }}>Speichern</button>
                    <button className="btn-secondary" onClick={() => setEditLocationId(null)}>Abbrechen</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate whitespace-nowrap" title={`${l.name} (${l.code || "--"})`}>
                      {l.name} ({l.code || "--"})
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconActionButton label="Lagerort bearbeiten" onClick={() => startEdit(l, "location")}>
                        <PencilLine size={20} />
                      </IconActionButton>
                      <IconActionButton
                        label="Lagerort loeschen"
                        onClick={async () => {
                          const { res, data } = await apiJson("/api/admin/locations", {
                            method: "DELETE",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: l.id })
                          });
                          setFeedback(res.ok ? "Lagerort geloescht" : `Lagerort-Loeschen fehlgeschlagen: ${data.error || "Unbekannt"}`);
                          if (res.ok) {
                            setLocations((prev) => removeById(prev, l.id));
                            setShelves((prev) => prev.filter((shelf) => shelf.storageLocationId !== l.id));
                            setDash((prev: any) => (prev ? { ...prev, locations: Math.max(0, prev.locations - 1) } : prev));
                          }
                        }}
                      >
                        <Trash2 size={20} />
                      </IconActionButton>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <form className="grid gap-2 sm:grid-cols-3" onSubmit={async (e) => {
            e.preventDefault();
            const formEl = e.currentTarget;
            const fd = new FormData(formEl);
            const { res, data } = await apiJson("/api/admin/locations", {
              method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: fd.get("name"), code: fd.get("code") })
            });
            setFeedback(res.ok ? "Lagerort angelegt" : `Lagerort anlegen fehlgeschlagen: ${data.error || "Unbekannt"}`);
            if (res.ok) {
              setLocations((prev) => sortByName([...prev, data]));
              setDash((prev: any) => (prev ? { ...prev, locations: prev.locations + 1 } : prev));
              formEl.reset();
            }
          }}>
            <input className="input" name="name" placeholder="Name" required />
            <input className="input" name="code" placeholder="Code" />
            <button className="btn-secondary" type="submit">Anlegen</button>
          </form>
        </section>

        <section className="card space-y-2">
          <h2 className="font-semibold">Regale</h2>
          <ul className="space-y-1 text-sm">
            {shelves.map((shelf) => (
              <li key={shelf.id} className="rounded border border-workshop-200 p-2">
                {editShelfId === shelf.id ? (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                    <select className="input min-w-0" value={editShelfLocationId} onChange={(e) => setEditShelfLocationId(e.target.value)}>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} ({location.code || "--"})
                        </option>
                      ))}
                    </select>
                    <input className="input min-w-0" value={editShelfName} onChange={(e) => setEditShelfName(e.target.value)} />
                    <button
                      className="btn-secondary px-2"
                      onClick={async () => {
                        const { res, data } = await apiJson("/api/admin/shelves", {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ id: shelf.id, name: editShelfName, storageLocationId: editShelfLocationId })
                        });
                        setFeedback(res.ok ? "Regal aktualisiert" : `Regal-Update fehlgeschlagen: ${data.error || "Unbekannt"}`);
                        if (res.ok) {
                          setShelves((prev) => sortShelves(replaceById(prev, data as ShelfRow)));
                          setEditShelfId(null);
                          setEditShelfName("");
                          setEditShelfLocationId("");
                        }
                      }}
                    >
                      Speichern
                    </button>
                    <button
                      className="btn-secondary px-2"
                      onClick={() => {
                        setEditShelfId(null);
                        setEditShelfName("");
                        setEditShelfLocationId("");
                      }}
                    >
                      Abbrechen
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate whitespace-nowrap" title={`${shelf.storageLocation?.name || "-"} · ${shelf.name}`}>
                      {shelf.name} · {shelf.storageLocation?.name || "-"}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconActionButton label="Regal bearbeiten" onClick={() => startEdit(shelf, "shelf")}>
                        <PencilLine size={20} />
                      </IconActionButton>
                      <IconActionButton
                        label="Regal loeschen"
                        onClick={async () => {
                          const { res, data } = await apiJson("/api/admin/shelves", {
                            method: "DELETE",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: shelf.id })
                          });
                          setFeedback(res.ok ? "Regal geloescht" : `Regal-Loeschen fehlgeschlagen: ${data.error || "Unbekannt"}`);
                          if (res.ok) {
                            setShelves((prev) => removeById(prev, shelf.id));
                          }
                        }}
                      >
                        <Trash2 size={20} />
                      </IconActionButton>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {shelves.length === 0 && <li className="rounded border border-dashed border-workshop-200 p-3 text-workshop-700">Noch keine Regale angelegt.</li>}
          </ul>
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const fd = new FormData(formEl);
              const { res, data } = await apiJson("/api/admin/shelves", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ name: fd.get("name"), storageLocationId: fd.get("storageLocationId") })
              });
              setFeedback(res.ok ? "Regal angelegt" : `Regal anlegen fehlgeschlagen: ${data.error || "Unbekannt"}`);
              if (res.ok) {
                setShelves((prev) => sortShelves([...(prev as ShelfRow[]), data as ShelfRow]));
                formEl.reset();
                setNewShelfLocationId(String(fd.get("storageLocationId") || newShelfLocationId));
              }
            }}
          >
            <select
              className="input min-w-0"
              name="storageLocationId"
              value={newShelfLocationId}
              onChange={(e) => setNewShelfLocationId(e.target.value)}
              required
              disabled={!locations.length}
            >
              {locations.length === 0 ? (
                <option value="">Erst Lagerort anlegen</option>
              ) : (
                locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.code || "--"})
                  </option>
                ))
              )}
            </select>
            <input className="input min-w-0" name="name" placeholder="Neues Regal" required disabled={!locations.length} />
            <button className="btn-secondary" type="submit" disabled={!locations.length}>
              Anlegen
            </button>
          </form>
        </section>

        <section className="card space-y-2 xl:col-span-2">
          <h2 className="font-semibold">Custom Fields</h2>
          <ul className="space-y-2 text-sm">
            {customFields.map((f) => (
              <li key={f.id} className="rounded border border-workshop-200 p-3">
                {editCustomId === f.id ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
                      <input className="input min-w-0" value={editCustom.name} onChange={(e) => setEditCustom((v) => ({ ...v, name: e.target.value }))} placeholder="Name" />
                      <input className="input min-w-0" value={editCustom.unit} onChange={(e) => setEditCustom((v) => ({ ...v, unit: e.target.value }))} placeholder="Einheit (optional)" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <select className="input" value={editCustom.type} onChange={(e) => setEditCustom((v) => ({ ...v, type: e.target.value }))}>
                        <option>TEXT</option>
                        <option>NUMBER</option>
                        <option>BOOLEAN</option>
                        <option>SELECT</option>
                        <option>MULTI_SELECT</option>
                        <option>DATE</option>
                      </select>
                      <select className="input" value={editCustom.categoryId} onChange={(e) => setEditCustom((v) => ({ ...v, categoryId: e.target.value }))}>
                        <option value="">Alle Kategorien</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name} ({category.code || "--"})
                          </option>
                        ))}
                      </select>
                      <select className="input" value={editCustom.typeId} onChange={(e) => setEditCustom((v) => ({ ...v, typeId: e.target.value }))}>
                        <option value="">Alle Types</option>
                        {types.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.code} - {type.name}
                          </option>
                        ))}
                      </select>
                      <label className="inline-flex items-center gap-2 rounded border border-workshop-200 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editCustom.required}
                          onChange={(e) => setEditCustom((v) => ({ ...v, required: e.target.checked }))}
                        />
                        Pflichtfeld
                      </label>
                    </div>
                    <input
                      className="input"
                      value={editCustom.optionsRaw}
                      onChange={(e) => setEditCustom((v) => ({ ...v, optionsRaw: e.target.value }))}
                      placeholder="Optionen fuer SELECT/MULTI_SELECT: Rot|Gruen|Blau"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        className="btn-secondary"
                        onClick={async () => {
                          const options = editCustom.optionsRaw
                            ? editCustom.optionsRaw
                                .split("|")
                                .map((entry) => entry.trim())
                                .filter(Boolean)
                            : null;
                          const { res, data } = await apiJson("/api/admin/custom-fields", {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              id: f.id,
                              name: editCustom.name,
                              type: editCustom.type,
                              unit: editCustom.unit || null,
                              categoryId: editCustom.categoryId || null,
                              typeId: editCustom.typeId || null,
                              required: editCustom.required,
                              options
                            })
                          });
                          setFeedback(res.ok ? "Custom Field aktualisiert" : `Custom Field Update fehlgeschlagen: ${data.error || "Unbekannt"}`);
                          if (res.ok) {
                            setCustomFields((prev) => sortByName(replaceById(prev, data)));
                            setEditCustomId(null);
                            setEditCustom({
                              name: "",
                              type: "TEXT",
                              unit: "",
                              optionsRaw: "",
                              categoryId: "",
                              typeId: "",
                              required: false
                            });
                          }
                        }}
                      >
                        Speichern
                      </button>
                      <button className="btn-secondary" onClick={() => setEditCustomId(null)}>
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {f.name}
                        {f.unit ? ` (${f.unit})` : ""}
                      </p>
                      <p className="theme-muted text-xs">
                        {f.type} • {describeCustomFieldScope(f)}
                        {f.required ? " • Pflicht" : ""}
                      </p>
                      {f.options ? (
                        <p className="theme-muted truncate text-xs">
                          Optionen: {(() => {
                            try {
                              const parsed = JSON.parse(f.options);
                              return Array.isArray(parsed) ? parsed.join(", ") : String(parsed);
                            } catch {
                              return f.options;
                            }
                          })()}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <IconActionButton label="Custom Field bearbeiten" onClick={() => startEdit(f, "custom")}>
                        <PencilLine size={20} />
                      </IconActionButton>
                      <IconActionButton
                        label="Custom Field loeschen"
                        onClick={async () => {
                          const { res, data } = await apiJson("/api/admin/custom-fields", {
                            method: "DELETE",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: f.id })
                          });
                          setFeedback(res.ok ? "Custom Field geloescht" : `Custom Field Loeschen fehlgeschlagen: ${data.error || "Unbekannt"}`);
                          if (res.ok) setCustomFields((prev) => removeById(prev, f.id));
                        }}
                      >
                        <Trash2 size={20} />
                      </IconActionButton>
                    </div>
                  </div>
                )}
              </li>
            ))}
            {customFields.length === 0 && <li className="rounded border border-dashed border-workshop-200 p-3 text-workshop-700">Noch keine Custom Fields angelegt.</li>}
          </ul>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const formEl = e.currentTarget;
              const fd = new FormData(formEl);
              const optionsRaw = String(fd.get("options") || "");
              const { res, data } = await apiJson("/api/admin/custom-fields", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  name: fd.get("name"),
                  unit: fd.get("unit") || null,
                  type: fd.get("type"),
                  categoryId: fd.get("categoryId") || null,
                  typeId: fd.get("typeId") || null,
                  required: fd.get("required") === "on",
                  options: optionsRaw
                    ? optionsRaw
                        .split("|")
                        .map((entry) => entry.trim())
                        .filter(Boolean)
                    : null
                })
              });
              setFeedback(res.ok ? "Custom Field angelegt" : `Custom Field anlegen fehlgeschlagen: ${data.error || "Unbekannt"}`);
              if (res.ok) {
                setCustomFields((prev) => sortByName([...(prev as CustomFieldRow[]), data as CustomFieldRow]));
                formEl.reset();
              }
            }}
          >
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
              <input className="input min-w-0" name="name" placeholder="Name" required />
              <input className="input min-w-0" name="unit" placeholder="Einheit (optional)" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <select className="input" name="type">
                <option>TEXT</option>
                <option>NUMBER</option>
                <option>BOOLEAN</option>
                <option>SELECT</option>
                <option>MULTI_SELECT</option>
                <option>DATE</option>
              </select>
              <select className="input" name="categoryId" defaultValue="">
                <option value="">Alle Kategorien</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.code || "--"})
                  </option>
                ))}
              </select>
              <select className="input" name="typeId" defaultValue="">
                <option value="">Alle Types</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.code} - {type.name}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 rounded border border-workshop-200 px-3 py-2 text-sm">
                <input type="checkbox" name="required" />
                Pflichtfeld
              </label>
            </div>
            <input className="input" name="options" placeholder="Optionen fuer SELECT/MULTI_SELECT: Rot|Gruen|Blau" />
            <button className="btn-secondary" type="submit">
              Anlegen
            </button>
          </form>
        </section>
      </div>

      {labelConfig && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Label-Code Einstellungen</h2>
          <form className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5" onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const { res, data } = await apiJson("/api/admin/label-config", {
              method: "PATCH", headers: { "content-type": "application/json" },
              body: JSON.stringify({
                separator: fd.get("separator"), digits: Number(fd.get("digits")), prefix: fd.get("prefix"), suffix: fd.get("suffix"),
                delimiter: fd.get("delimiter"), regenerateOnType: !!fd.get("regenerateOnType")
              })
            });
            setFeedback(res.ok ? "Label-Code Einstellungen gespeichert" : `Label-Code Einstellungen fehlgeschlagen: ${data.error || "Unbekannt"}`);
            if (res.ok) setLabelConfig(data);
          }}>
            <input className="input" name="separator" defaultValue={labelConfig.separator} placeholder="-" />
            <input className="input" name="digits" type="number" min={2} max={6} defaultValue={labelConfig.digits} />
            <input className="input" name="prefix" defaultValue={labelConfig.prefix || ""} placeholder="Prefix" />
            <input className="input" name="suffix" defaultValue={labelConfig.suffix || ""} placeholder="Suffix" />
            <input className="input" name="delimiter" defaultValue={labelConfig.delimiter || ";"} placeholder="CSV Delimiter" />
            <label className="text-sm sm:col-span-2 xl:col-span-1"><input type="checkbox" name="regenerateOnType" defaultChecked={labelConfig.regenerateOnType} /> Neuen Code bei Kategorie/Type Aenderung</label>
            <button className="btn sm:col-span-2 xl:col-span-2">Speichern</button>
          </form>
        </section>
      )}
    </div>
  );
}
