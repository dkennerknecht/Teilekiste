"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";
import { translateApiErrorMessage } from "@/lib/app-language";
import { importCoreTargets, type ImportProfileMappingConfig } from "@/lib/import-profiles";

type LookupRow = {
  id: string;
  name: string;
  code?: string | null;
};

type CustomFieldRow = {
  id: string;
  name: string;
  key: string;
  categoryId?: string | null;
  typeId?: string | null;
};

type ImportProfileRow = {
  id: string;
  name: string;
  description?: string | null;
  headerFingerprint?: string | null;
  delimiterMode: string;
  mappingConfig: ImportProfileMappingConfig;
};

type ImportPreview = {
  ok: boolean;
  delimiter: string;
  delimiterMode: string;
  headerFingerprint: string;
  headers: Array<{
    header: string;
    mappedTargetKeys: string[];
    suggestedTargetKeys: string[];
    status: "mapped" | "suggested" | "ignored" | "unmapped";
  }>;
  mappingConfig: ImportProfileMappingConfig;
  mappingIssues: Array<{ fieldKey: string; message: string }>;
  profileMatches: Array<{ id: string; name: string; description?: string | null; score: number; delimiterMode: string }>;
  totalRows: number;
  readyRows: number;
  errorsCount: number;
  warningsCount: number;
  rows: Array<{
    lineNumber: number;
    status: "ready" | "error";
    input: Record<string, string>;
    resolved: {
      name: string;
      category: { name: string; code?: string | null } | null;
      type: { name: string; code?: string | null } | null;
      storageLocation: { name: string; code?: string | null } | null;
      unit: string;
      stock: number;
      minStock: number | null;
      manufacturer: string | null;
      mpn: string | null;
      datasheetUrl: string | null;
      purchaseUrl: string | null;
      customFields: Array<{ customFieldId: string; fieldName: string; displayValue: string }>;
    } | null;
    errors: Array<{ fieldKey: string; message: string }>;
    warnings: Array<{ fieldKey: string; message: string }>;
  }>;
  created?: number;
  createdItems?: Array<{ id: string; labelCode: string; name: string }>;
};

const emptyMappingConfig = (): ImportProfileMappingConfig => ({
  assignments: []
});

function getAssignment(config: ImportProfileMappingConfig, targetKey: string) {
  return config.assignments.find((assignment) => assignment.targetKey === targetKey) || null;
}

function upsertAssignment(
  config: ImportProfileMappingConfig,
  nextAssignment: { targetKey: string; sourceType: "column" | "fixed" | "ignore"; column?: string | null; fixedValue?: string | null }
) {
  const assignments = config.assignments.filter((assignment) => assignment.targetKey !== nextAssignment.targetKey);
  assignments.push({
    targetKey: nextAssignment.targetKey,
    sourceType: nextAssignment.sourceType,
    column: nextAssignment.column ?? null,
    fixedValue: nextAssignment.fixedValue ?? null
  });
  assignments.sort((left, right) => left.targetKey.localeCompare(right.targetKey, "de"));
  return { assignments };
}

function targetLabel(targetKey: string, customFields: CustomFieldRow[]) {
  const core = importCoreTargets.find((entry) => entry.key === targetKey);
  if (core) return core.label;
  if (!targetKey.startsWith("customField:")) return targetKey;
  const fieldId = targetKey.slice("customField:".length);
  const field = customFields.find((entry) => entry.id === fieldId);
  return field ? `${field.name} [Custom Field]` : `${targetKey} [fehlt]`;
}

function buildTargetList(customFields: CustomFieldRow[]) {
  return [
    ...importCoreTargets.map((entry) => ({ key: entry.key, label: entry.label, kind: "core" as const })),
    ...customFields.map((field) => ({
      key: `customField:${field.id}`,
      label: `${field.name} [Custom Field]`,
      kind: "custom" as const
    }))
  ];
}

function createProfileDraft(profile: ImportProfileRow | null) {
  return {
    name: profile?.name || "",
    description: profile?.description || ""
  };
}

export default function AdminImportPage() {
  const { language } = useAppLanguage();
  const tr = (de: string, en: string) => (language === "en" ? en : de);
  const [categories, setCategories] = useState<LookupRow[]>([]);
  const [types, setTypes] = useState<LookupRow[]>([]);
  const [locations, setLocations] = useState<LookupRow[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([]);
  const [profiles, setProfiles] = useState<ImportProfileRow[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileDraft, setProfileDraft] = useState({ name: "", description: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mappingDraft, setMappingDraft] = useState<ImportProfileMappingConfig>(emptyMappingConfig);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) || null,
    [profiles, selectedProfileId]
  );

  const mappingTargets = useMemo(() => buildTargetList(customFields), [customFields]);
  const availableHeaders = preview?.headers.map((entry) => entry.header) || [];

  const load = useCallback(async () => {
    const [categoryData, typeData, locationData, fieldData, profileData] = await Promise.all([
      fetch("/api/admin/categories", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/admin/types", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/admin/locations", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/admin/custom-fields", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/admin/import-profiles", { cache: "no-store" }).then((res) => res.json())
    ]);

    setCategories(categoryData);
    setTypes(typeData);
    setLocations(locationData);
    setCustomFields((fieldData || []).filter((field: any) => field.isActive !== false));
    setProfiles(profileData || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedProfile) {
      setProfileDraft(createProfileDraft(selectedProfile));
      setMappingDraft(selectedProfile.mappingConfig || emptyMappingConfig());
      setFeedback("");
      setError("");
    }
  }, [selectedProfile]);

  async function runPreview() {
    if (!selectedFile) {
      setError(tr("Bitte zuerst eine CSV-Datei waehlen.", "Please choose a CSV file first."));
      return;
    }

    setBusy(true);
    setError("");
    setFeedback("");

    const form = new FormData();
    form.set("file", selectedFile);
    if (selectedProfileId) form.set("profileId", selectedProfileId);
    form.set("mappingDraft", JSON.stringify(mappingDraft));

    const res = await fetch("/api/admin/import/preview", {
      method: "POST",
      body: form
    });
    const data = await res.json().catch(() => null);
    setBusy(false);

    if (!res.ok) {
      setPreview(null);
      setError(translateApiErrorMessage(language, data?.error) || tr("Preview konnte nicht geladen werden.", "Preview could not be loaded."));
      return;
    }

    setPreview(data);
    setMappingDraft(data.mappingConfig || emptyMappingConfig());
    setFeedback(tr(`Preview geladen: ${data.readyRows}/${data.totalRows} Zeilen bereit.`, `Preview loaded: ${data.readyRows}/${data.totalRows} rows ready.`));
  }

  async function runApply() {
    if (!selectedFile || !preview) return;
    setBusy(true);
    setError("");
    setFeedback("");

    const form = new FormData();
    form.set("file", selectedFile);
    if (selectedProfileId) form.set("profileId", selectedProfileId);
    form.set("mappingDraft", JSON.stringify(mappingDraft));

    const res = await fetch("/api/admin/import/apply", {
      method: "POST",
      body: form
    });
    const data = await res.json().catch(() => null);
    setBusy(false);

    if (!res.ok) {
      setPreview(data);
      setError(translateApiErrorMessage(language, data?.error) || tr("Import fehlgeschlagen.", "Import failed."));
      return;
    }

    setPreview(data);
    setFeedback(tr(`Import abgeschlossen: ${data.created || 0} Artikel angelegt.`, `Import complete: ${data.created || 0} items created.`));
  }

  async function saveProfile(mode: "create" | "update") {
    if (!profileDraft.name.trim()) {
      setError(tr("Profilname fehlt.", "Profile name is missing."));
      return;
    }

    setProfileBusy(true);
    setError("");
    setFeedback("");

    const payload = {
      ...(mode === "update" && selectedProfileId ? { id: selectedProfileId } : {}),
      name: profileDraft.name.trim(),
      description: profileDraft.description.trim() || null,
      headerFingerprint: preview?.headerFingerprint || null,
      delimiterMode: preview?.delimiterMode || selectedProfile?.delimiterMode || "AUTO",
      mappingConfig: mappingDraft
    };

    const res = await fetch("/api/admin/import-profiles", {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => null);
    setProfileBusy(false);

    if (!res.ok) {
      setError(translateApiErrorMessage(language, data?.error) || tr("Profil konnte nicht gespeichert werden.", "Profile could not be saved."));
      return;
    }

    await load();
    setSelectedProfileId(data.id);
    setFeedback(mode === "create" ? tr("Profil gespeichert.", "Profile saved.") : tr("Profil aktualisiert.", "Profile updated."));
  }

  async function deleteProfile() {
    if (!selectedProfileId) return;
    setProfileBusy(true);
    setError("");
    setFeedback("");

    const res = await fetch("/api/admin/import-profiles", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: selectedProfileId })
    });
    const data = await res.json().catch(() => null);
    setProfileBusy(false);

    if (!res.ok) {
      setError(translateApiErrorMessage(language, data?.error) || tr("Profil konnte nicht geloescht werden.", "Profile could not be deleted."));
      return;
    }

    setSelectedProfileId("");
    setProfileDraft({ name: "", description: "" });
    setMappingDraft(emptyMappingConfig());
    await load();
    setFeedback(tr("Profil geloescht.", "Profile deleted."));
  }

  function setAssignmentSourceType(targetKey: string, sourceType: "column" | "fixed" | "ignore") {
    const current = getAssignment(mappingDraft, targetKey);
    setMappingDraft(
      upsertAssignment(mappingDraft, {
        targetKey,
        sourceType,
        column: sourceType === "column" ? current?.column || availableHeaders[0] || null : null,
        fixedValue: sourceType === "fixed" ? current?.fixedValue || null : null
      })
    );
  }

  function setAssignmentColumn(targetKey: string, column: string) {
    const current = getAssignment(mappingDraft, targetKey);
    setMappingDraft(
      upsertAssignment(mappingDraft, {
        targetKey,
        sourceType: current?.sourceType === "fixed" ? "fixed" : "column",
        column,
        fixedValue: current?.fixedValue || null
      })
    );
  }

  function setAssignmentFixedValue(targetKey: string, fixedValue: string) {
    const current = getAssignment(mappingDraft, targetKey);
    setMappingDraft(
      upsertAssignment(mappingDraft, {
        targetKey,
        sourceType: "fixed",
        column: current?.column || null,
        fixedValue
      })
    );
  }

  function renderFixedValueInput(targetKey: string) {
    const assignment = getAssignment(mappingDraft, targetKey);
    const value = assignment?.fixedValue || "";

    if (targetKey === "category") {
      return (
        <select className="input" value={value} onChange={(e) => setAssignmentFixedValue(targetKey, e.target.value)}>
          <option value="">{tr("Kategorie waehlen", "Choose category")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({category.code || "--"})
            </option>
          ))}
        </select>
      );
    }

    if (targetKey === "type") {
      return (
        <select className="input" value={value} onChange={(e) => setAssignmentFixedValue(targetKey, e.target.value)}>
          <option value="">{tr("Type waehlen", "Choose type")}</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {(type.code || "--")} - {type.name}
            </option>
          ))}
        </select>
      );
    }

    if (targetKey === "storageLocation") {
      return (
        <select className="input" value={value} onChange={(e) => setAssignmentFixedValue(targetKey, e.target.value)}>
          <option value="">{tr("Lagerort waehlen", "Choose storage location")}</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name} ({location.code || "--"})
            </option>
          ))}
        </select>
      );
    }

    if (targetKey === "unit") {
      return (
        <select className="input" value={value} onChange={(e) => setAssignmentFixedValue(targetKey, e.target.value)}>
          <option value="">{tr("Einheit waehlen", "Choose unit")}</option>
          {["STK", "M", "SET", "PACK"].map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        className="input"
        value={value}
        onChange={(e) => setAssignmentFixedValue(targetKey, e.target.value)}
        placeholder={tr("Fester Wert", "Fixed value")}
      />
    );
  }

  const canApply = Boolean(
    selectedFile &&
      preview &&
      preview.mappingIssues.length === 0 &&
      preview.rows.every((row) => row.status === "ready")
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{tr("Import", "Import")}</h1>
          <p className="text-sm text-workshop-700">{tr("Admin-Wizard fuer CSV-Profile, Feldzuordnung, Preview und strikten Apply.", "Admin wizard for CSV profiles, field mapping, previews, and strict apply.")}</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary" href="/admin">
            {tr("Zurueck zu Admin", "Back to admin")}
          </Link>
          <Link className="btn-secondary" href="/admin/data-quality">
            {tr("Datenqualitaet", "Data Quality")}
          </Link>
        </div>
      </div>

      {feedback && <div className="rounded border border-workshop-300 bg-workshop-100 p-2 text-sm">{feedback}</div>}
      {error && <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</div>}

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{tr("1. Datei und Profil", "1. File and profile")}</h2>
        <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            <input
              className="input"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] || null);
                setPreview(null);
              }}
            />
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                className="input"
                value={selectedProfileId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedProfileId(nextId);
                  const nextProfile = profiles.find((profile) => profile.id === nextId) || null;
                  setProfileDraft(createProfileDraft(nextProfile));
                  setMappingDraft(nextProfile?.mappingConfig || emptyMappingConfig());
                }}
              >
                <option value="">{tr("Kein Profil", "No profile")}</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
              <button className="btn-secondary" type="button" disabled={busy || !selectedFile} onClick={runPreview}>
                {busy ? tr("Laedt...", "Loading...") : tr("Preview laden", "Load preview")}
              </button>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-workshop-200 p-3">
            <p className="text-sm font-semibold">{tr("Profilpflege", "Profile management")}</p>
            <input
              className="input"
              value={profileDraft.name}
              onChange={(e) => setProfileDraft((current) => ({ ...current, name: e.target.value }))}
              placeholder={tr("Profilname", "Profile name")}
            />
            <textarea
              className="input min-h-24"
              value={profileDraft.description}
              onChange={(e) => setProfileDraft((current) => ({ ...current, description: e.target.value }))}
              placeholder={tr("Beschreibung der Quelle", "Source description")}
            />
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" type="button" disabled={profileBusy} onClick={() => saveProfile("create")}>
                {tr("Als neues Profil speichern", "Save as new profile")}
              </button>
              <button
                className="btn-secondary"
                type="button"
                disabled={profileBusy || !selectedProfileId}
                onClick={() => saveProfile("update")}
              >
                {tr("Profil aktualisieren", "Update profile")}
              </button>
              <button
                className="btn-secondary"
                type="button"
                disabled={profileBusy || !selectedProfileId}
                onClick={deleteProfile}
              >
                {tr("Profil loeschen", "Delete profile")}
              </button>
            </div>
            {preview && (
              <div className="text-sm text-workshop-700">
                <p>Fingerprint: <span className="font-mono text-xs">{preview.headerFingerprint || "-"}</span></p>
                <p>Delimiter: {preview.delimiterMode} ({preview.delimiter})</p>
              </div>
            )}
          </div>
        </div>

        {!!preview?.profileMatches?.length && (
          <div className="space-y-2 rounded-xl border border-workshop-200 p-3">
            <p className="text-sm font-semibold">{tr("Profilvorschlaege", "Profile suggestions")}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {preview.profileMatches.map((match) => (
                <div key={match.id} className="rounded-lg border border-workshop-200 p-3 text-sm">
                  <p className="font-semibold">{match.name}</p>
                  <p className="text-workshop-700">Score {match.score} / Delimiter {match.delimiterMode}</p>
                  {match.description && <p className="text-workshop-700">{match.description}</p>}
                  <button
                    className="btn-secondary mt-2"
                    type="button"
                    onClick={() => {
                      const nextProfile = profiles.find((profile) => profile.id === match.id) || null;
                      setSelectedProfileId(match.id);
                      setProfileDraft(createProfileDraft(nextProfile));
                      setMappingDraft(nextProfile?.mappingConfig || emptyMappingConfig());
                    }}
                  >
                    {tr("Profil uebernehmen", "Use profile")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{tr("2. Mapping", "2. Mapping")}</h2>
            <p className="text-sm text-workshop-700">{tr("Nach der ersten Preview koennen Zuordnungen angepasst und erneut ausgewertet werden.", "After the first preview, mappings can be adjusted and re-evaluated.")}</p>
          </div>
          <button className="btn-secondary" type="button" disabled={!selectedFile || busy} onClick={runPreview}>
            {tr("Mapping neu auswerten", "Re-run mapping")}
          </button>
        </div>

        {!preview ? (
          <div className="rounded border border-dashed border-workshop-300 p-4 text-sm text-workshop-700">
            {tr("Erst eine Datei auswaehlen und Preview laden.", "Choose a file and load the preview first.")}
          </div>
        ) : (
          <div className="space-y-4">
            {preview.mappingIssues.length > 0 && (
              <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {preview.mappingIssues.map((issue) => (
                  <p key={`${issue.fieldKey}:${issue.message}`}>
                    {targetLabel(issue.fieldKey, customFields)}: {translateApiErrorMessage(language, issue.message) || issue.message}
                  </p>
                ))}
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-2">
              {mappingTargets.map((target) => {
                const assignment = getAssignment(mappingDraft, target.key);
                return (
                  <div key={target.key} className="rounded-xl border border-workshop-200 p-3">
                    <p className="text-sm font-semibold">{target.label}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
                      <select
                        className="input"
                        value={assignment?.sourceType || "ignore"}
                        onChange={(e) => setAssignmentSourceType(target.key, e.target.value as "column" | "fixed" | "ignore")}
                      >
                        <option value="ignore">{tr("Ignorieren", "Ignore")}</option>
                        <option value="column">{tr("CSV-Spalte", "CSV column")}</option>
                        <option value="fixed">{tr("Fester Wert", "Fixed value")}</option>
                      </select>

                      {assignment?.sourceType === "column" ? (
                        <select
                          className="input"
                          value={assignment.column || ""}
                          onChange={(e) => setAssignmentColumn(target.key, e.target.value)}
                        >
                          <option value="">{tr("Spalte waehlen", "Choose column")}</option>
                          {availableHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      ) : assignment?.sourceType === "fixed" ? (
                        renderFixedValueInput(target.key)
                      ) : (
                        <div className="rounded border border-dashed border-workshop-300 px-3 py-2 text-sm text-workshop-600">
                          {tr("Keine Zuordnung", "No mapping")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{tr("3. Preview und Apply", "3. Preview and apply")}</h2>
            {preview && (
              <p className="text-sm text-workshop-700">
                {tr("Zeilen", "Rows")}: {preview.totalRows} | {tr("bereit", "ready")}: {preview.readyRows} | {tr("Fehler", "Errors")}: {preview.errorsCount} | {tr("Warnungen", "Warnings")}: {preview.warningsCount}
              </p>
            )}
          </div>
          <button className="btn" type="button" disabled={!canApply || busy} onClick={runApply}>
            {busy ? tr("Laeuft...", "Running...") : tr("Apply ausfuehren", "Run apply")}
          </button>
        </div>

        {!preview ? (
          <div className="rounded border border-dashed border-workshop-300 p-4 text-sm text-workshop-700">
            {tr("Noch keine Preview vorhanden.", "No preview available yet.")}
          </div>
        ) : (
          <div className="space-y-3">
            {!!preview.createdItems?.length && (
              <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
                {tr("Angelegt", "Created")}: {preview.createdItems.map((item) => `${item.labelCode} (${item.name})`).join(", ")}
              </div>
            )}

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {preview.headers.map((entry) => (
                <div key={entry.header} className="rounded-lg border border-workshop-200 p-3 text-sm">
                  <p className="font-semibold">{entry.header}</p>
                  <p className="text-workshop-700">
                    {entry.status === "mapped"
                      ? `${tr("Mapped", "Mapped")}: ${entry.mappedTargetKeys.join(", ")}`
                      : entry.status === "suggested"
                        ? `${tr("Vorschlag", "Suggestion")}: ${entry.suggestedTargetKeys.join(", ")}`
                        : entry.status === "ignored"
                          ? tr("Ignoriert", "Ignored")
                          : tr("Nicht zugeordnet", "Unmapped")}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {preview.rows.slice(0, 50).map((row) => (
                <article
                  key={row.lineNumber}
                  className={`rounded-xl border p-3 ${
                    row.status === "ready" ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      {tr("Zeile", "Row")} {row.lineNumber} - {row.status === "ready" ? tr("bereit", "ready") : tr("fehlerhaft", "invalid")}
                    </p>
                    {row.resolved && (
                      <p className="text-sm text-workshop-700">
                        {row.resolved.category?.name || "-"} / {row.resolved.type?.code || row.resolved.type?.name || "-"} / {row.resolved.storageLocation?.name || "-"}
                      </p>
                    )}
                  </div>

                  {row.resolved && (
                    <div className="mt-2 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
                      <p>{tr("Name", "Name")}: {row.resolved.name}</p>
                      <p>{tr("Bestand", "Stock")}: {row.resolved.stock} {row.resolved.unit}</p>
                      <p>{tr("Mindestbestand", "Minimum stock")}: {row.resolved.minStock ?? "-"} {row.resolved.unit}</p>
                      <p>{tr("Hersteller", "Manufacturer")}: {row.resolved.manufacturer || "-"}</p>
                      <p>MPN: {row.resolved.mpn || "-"}</p>
                      <p>{tr("Datenblatt", "Datasheet")}: {row.resolved.datasheetUrl || "-"}</p>
                      {!!row.resolved.customFields.length && (
                        <p className="md:col-span-2 xl:col-span-3">
                          {tr("Custom Fields", "Custom fields")}: {row.resolved.customFields.map((field) => `${field.fieldName}: ${field.displayValue}`).join(" | ")}
                        </p>
                      )}
                    </div>
                  )}

                  {!!row.errors.length && (
                    <div className="mt-2 text-sm text-red-700">
                      {row.errors.map((entry) => (
                        <p key={`${row.lineNumber}:${entry.fieldKey}:${entry.message}`}>
                          {targetLabel(entry.fieldKey, customFields)}: {translateApiErrorMessage(language, entry.message) || entry.message}
                        </p>
                      ))}
                    </div>
                  )}

                  {!!row.warnings.length && (
                    <div className="mt-2 text-sm text-amber-700">
                      {row.warnings.map((entry) => (
                        <p key={`${row.lineNumber}:${entry.fieldKey}:${entry.message}`}>
                          {targetLabel(entry.fieldKey, customFields)}: {translateApiErrorMessage(language, entry.message) || entry.message}
                        </p>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
