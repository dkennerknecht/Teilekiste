"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";
import { translateApiErrorMessage } from "@/lib/app-language";

type DuplicatePair = {
  leftItem: {
    id: string;
    labelCode: string;
    name: string;
    category?: { name: string } | null;
    labelType?: { code: string; name: string } | null;
    unit: string;
  };
  rightItem: {
    id: string;
    labelCode: string;
    name: string;
    category?: { name: string } | null;
    labelType?: { code: string; name: string } | null;
    unit: string;
  };
  score: number;
  reasons: string[];
  mergeEligible: boolean;
  mergeBlockedReasons: string[];
};

type MergePreview = {
  sourceItem: { id: string; labelCode: string; name: string; stock: number; unit: string };
  targetItem: { id: string; labelCode: string; name: string; stock: number; unit: string };
  scoreInfo: { resultingStock: number; unit: string };
  relationCounts: {
    source: Record<string, number>;
    target: Record<string, number>;
  };
  coreFieldConflicts: Array<{
    fieldKey: string;
    label: string;
    sourceDisplayValue: string;
    targetDisplayValue: string;
    defaultSelection: "source" | "target";
    requiresSelection: boolean;
  }>;
  customFieldConflicts: Array<{
    customFieldId: string;
    fieldName: string;
    sourceDisplayValue: string;
    targetDisplayValue: string;
    defaultSelection: "source" | "target";
    requiresSelection: boolean;
  }>;
  defaultFieldSelections: Record<string, "source" | "target">;
  defaultCustomFieldSelections: Record<string, "source" | "target">;
};

export default function DataQualityPage() {
  const { language } = useAppLanguage();
  const tr = (de: string, en: string) => (language === "en" ? en : de);
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(45);
  const [onlyMergeEligible, setOnlyMergeEligible] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [fieldSelections, setFieldSelections] = useState<Record<string, "source" | "target">>({});
  const [customFieldSelections, setCustomFieldSelections] = useState<Record<string, "source" | "target">>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/admin/duplicates?minScore=${minScore}&onlyMergeEligible=${onlyMergeEligible ? 1 : 0}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    setPairs(data.items || []);
    setLoading(false);
  }, [minScore, onlyMergeEligible]);

  useEffect(() => {
    load();
  }, [load]);

  async function openPreview(sourceItemId: string, targetItemId: string) {
    setPreviewBusy(true);
    setPreviewError("");
    setFeedback("");
    const res = await fetch("/api/admin/duplicates/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceItemId, targetItemId })
    });
      const data = await res.json().catch(() => null);
      setPreviewBusy(false);

      if (!res.ok) {
        setPreview(null);
        setFieldSelections({});
        setCustomFieldSelections({});
        setPreviewError(translateApiErrorMessage(language, data?.error) || tr("Preview konnte nicht geladen werden.", "Preview could not be loaded."));
        return;
      }

    setPreview(data);
    setFieldSelections(data.defaultFieldSelections || {});
    setCustomFieldSelections(data.defaultCustomFieldSelections || {});
  }

  async function mergePreview() {
    if (!preview || mergeBusy) return;
    setMergeBusy(true);
    setFeedback("");
    const res = await fetch("/api/admin/duplicates/merge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceItemId: preview.sourceItem.id,
        targetItemId: preview.targetItem.id,
        fieldSelections,
        customFieldSelections
      })
    });
    const data = await res.json().catch(() => null);
    setMergeBusy(false);

    if (!res.ok) {
      setFeedback(translateApiErrorMessage(language, data?.error) || tr("Merge fehlgeschlagen.", "Merge failed."));
      return;
    }

    setFeedback(tr(`Merge abgeschlossen: ${preview.sourceItem.labelCode} -> ${preview.targetItem.labelCode}`, `Merge complete: ${preview.sourceItem.labelCode} -> ${preview.targetItem.labelCode}`));
    setPreview(null);
    setFieldSelections({});
    setCustomFieldSelections({});
    await load();
  }

  const changedCoreFields = preview?.coreFieldConflicts.filter(
    (field) => field.requiresSelection || field.sourceDisplayValue !== field.targetDisplayValue
  ) || [];
  const changedCustomFields = preview?.customFieldConflicts.filter(
    (field) => field.requiresSelection || field.sourceDisplayValue !== field.targetDisplayValue
  ) || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{tr("Deduplizierung & Datenqualitaet", "Deduplication & Data Quality")}</h1>
          <p className="text-sm text-workshop-700">{tr("Admin-Workflow fuer Dubletten, Merge-Preview und sicheres Zusammenfuehren.", "Admin workflow for duplicates, merge previews, and safe merges.")}</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary" href="/admin">
            {tr("Zurueck zu Admin", "Back to admin")}
          </Link>
          <Link className="btn-secondary" href="/admin/audit">
            Audit
          </Link>
        </div>
      </div>

      <div className="card flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="text-sm">
          {tr("Mindest-Score", "Minimum score")}
          <input
            className="input mt-1 w-28"
            type="number"
            min={0}
            max={200}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value || 45))}
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyMergeEligible}
            onChange={(e) => setOnlyMergeEligible(e.target.checked)}
          />
          {tr("Nur mergebare Paare", "Merge-eligible pairs only")}
        </label>
        <button className="btn-secondary" type="button" onClick={load}>
          {tr("Neu laden", "Reload")}
        </button>
      </div>

      {feedback && <div className="rounded border border-workshop-300 bg-workshop-100 p-2 text-sm">{feedback}</div>}
      {previewError && <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{previewError}</div>}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-3">
          {loading ? (
            <div className="card text-sm">{tr("Lade Dubletten...", "Loading duplicates...")}</div>
          ) : pairs.length === 0 ? (
            <div className="card text-sm text-workshop-700">{tr("Keine Dubletten-Kandidaten fuer die aktuelle Filterung gefunden.", "No duplicate candidates found for the current filter.")}</div>
          ) : (
            pairs.map((pair) => (
              <article key={`${pair.leftItem.id}:${pair.rightItem.id}`} className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">Score {pair.score}</p>
                    <p className="text-xs text-workshop-700">{pair.reasons.join(", ")}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      pair.mergeEligible
                        ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border border-yellow-300 bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {pair.mergeEligible ? tr("Merge moeglich", "Merge available") : tr("Nur Warnung", "Warning only")}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-workshop-200 p-3">
                    <p className="font-mono text-sm text-workshop-700">{pair.leftItem.labelCode}</p>
                    <p className="font-semibold">{pair.leftItem.name}</p>
                    <p className="text-sm text-workshop-700">
                      {pair.leftItem.category?.name || "-"} / {pair.leftItem.labelType?.code || "--"} / {pair.leftItem.unit}
                    </p>
                  </div>
                  <div className="rounded-lg border border-workshop-200 p-3">
                    <p className="font-mono text-sm text-workshop-700">{pair.rightItem.labelCode}</p>
                    <p className="font-semibold">{pair.rightItem.name}</p>
                    <p className="text-sm text-workshop-700">
                      {pair.rightItem.category?.name || "-"} / {pair.rightItem.labelType?.code || "--"} / {pair.rightItem.unit}
                    </p>
                  </div>
                </div>

                {pair.mergeEligible ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      className="btn-secondary"
                      type="button"
                      disabled={previewBusy}
                      onClick={() => openPreview(pair.leftItem.id, pair.rightItem.id)}
                    >
                      {previewBusy ? tr("Laedt...", "Loading...") : `${pair.leftItem.labelCode} -> ${pair.rightItem.labelCode}`}
                    </button>
                    <button
                      className="btn-secondary"
                      type="button"
                      disabled={previewBusy}
                      onClick={() => openPreview(pair.rightItem.id, pair.leftItem.id)}
                    >
                      {previewBusy ? tr("Laedt...", "Loading...") : `${pair.rightItem.labelCode} -> ${pair.leftItem.labelCode}`}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-workshop-700">{pair.mergeBlockedReasons.join(", ")}</p>
                )}
              </article>
            ))
          )}
        </section>

        <section className="space-y-3">
          {!preview ? (
            <div className="card text-sm text-workshop-700">{tr("Waehle fuer ein Paar eine Merge-Richtung, um die Preview und Konfliktaufloesung zu laden.", "Choose a merge direction for a pair to load the preview and conflict resolution.")}</div>
          ) : (
            <div className="card space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{tr("Merge-Preview", "Merge preview")}</h2>
                <p className="mt-1 text-sm text-workshop-700">
                  {tr("Quelle", "Source")}: <span className="font-mono">{preview.sourceItem.labelCode}</span> {"->"} {tr("Ziel", "Target")}:{" "}
                  <span className="font-mono">{preview.targetItem.labelCode}</span>
                </p>
                <p className="mt-1 text-sm text-workshop-700">
                  {tr("Resultierender Bestand", "Resulting stock")}: {preview.scoreInfo.resultingStock} {preview.scoreInfo.unit}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-workshop-200 p-3 text-sm">
                  <p className="font-semibold">{tr("Quelle", "Source")}</p>
                  <p>{preview.sourceItem.name}</p>
                  <p className="font-mono text-workshop-700">{preview.sourceItem.labelCode}</p>
                </div>
                <div className="rounded-lg border border-workshop-200 p-3 text-sm">
                  <p className="font-semibold">{tr("Ziel", "Target")}</p>
                  <p>{preview.targetItem.name}</p>
                  <p className="font-mono text-workshop-700">{preview.targetItem.labelCode}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">{tr("Umzuhaengende Relationen", "Relations to move")}</p>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {Object.entries(preview.relationCounts.source).map(([key, value]) => (
                    <div key={key} className="rounded border border-workshop-200 px-3 py-2">
                      {key}: {value}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-sm font-semibold">{tr("Kernfelder", "Core fields")}</p>
                  <div className="space-y-2">
                    {changedCoreFields.length === 0 && <p className="text-sm text-workshop-700">{tr("Keine abweichenden Kernfelder.", "No differing core fields.")}</p>}
                    {changedCoreFields.map((field) => (
                      <div key={field.fieldKey} className="rounded-lg border border-workshop-200 p-3 text-sm">
                        <p className="font-medium">{field.label}</p>
                        <label className="mt-2 flex cursor-pointer items-start gap-2">
                          <input
                            type="radio"
                            name={`field-${field.fieldKey}`}
                            checked={(fieldSelections[field.fieldKey] || field.defaultSelection) === "source"}
                            onChange={() => setFieldSelections((prev) => ({ ...prev, [field.fieldKey]: "source" }))}
                          />
                          <span>
                            <span className="font-mono text-xs text-workshop-700">{preview.sourceItem.labelCode}</span>
                            <br />
                            {field.sourceDisplayValue}
                          </span>
                        </label>
                        <label className="mt-2 flex cursor-pointer items-start gap-2">
                          <input
                            type="radio"
                            name={`field-${field.fieldKey}`}
                            checked={(fieldSelections[field.fieldKey] || field.defaultSelection) === "target"}
                            onChange={() => setFieldSelections((prev) => ({ ...prev, [field.fieldKey]: "target" }))}
                          />
                          <span>
                            <span className="font-mono text-xs text-workshop-700">{preview.targetItem.labelCode}</span>
                            <br />
                            {field.targetDisplayValue}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold">{tr("Custom Fields", "Custom fields")}</p>
                  <div className="space-y-2">
                    {changedCustomFields.length === 0 && <p className="text-sm text-workshop-700">{tr("Keine abweichenden Custom-Field-Werte.", "No differing custom field values.")}</p>}
                    {changedCustomFields.map((field) => (
                      <div key={field.customFieldId} className="rounded-lg border border-workshop-200 p-3 text-sm">
                        <p className="font-medium">{field.fieldName}</p>
                        <label className="mt-2 flex cursor-pointer items-start gap-2">
                          <input
                            type="radio"
                            name={`custom-${field.customFieldId}`}
                            checked={(customFieldSelections[field.customFieldId] || field.defaultSelection) === "source"}
                            onChange={() => setCustomFieldSelections((prev) => ({ ...prev, [field.customFieldId]: "source" }))}
                          />
                          <span>
                            <span className="font-mono text-xs text-workshop-700">{preview.sourceItem.labelCode}</span>
                            <br />
                            {field.sourceDisplayValue}
                          </span>
                        </label>
                        <label className="mt-2 flex cursor-pointer items-start gap-2">
                          <input
                            type="radio"
                            name={`custom-${field.customFieldId}`}
                            checked={(customFieldSelections[field.customFieldId] || field.defaultSelection) === "target"}
                            onChange={() => setCustomFieldSelections((prev) => ({ ...prev, [field.customFieldId]: "target" }))}
                          />
                          <span>
                            <span className="font-mono text-xs text-workshop-700">{preview.targetItem.labelCode}</span>
                            <br />
                            {field.targetDisplayValue}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button className="btn" type="button" disabled={mergeBusy} onClick={mergePreview}>
                  {mergeBusy ? tr("Mergt...", "Merging...") : tr("Merge ausfuehren", "Run merge")}
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setFieldSelections({});
                    setCustomFieldSelections({});
                  }}
                >
                  {tr("Preview schliessen", "Close preview")}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
