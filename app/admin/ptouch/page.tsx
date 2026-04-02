"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";

const exportModes = ["all", "shelves", "drawers"] as const;
type ExportMode = (typeof exportModes)[number];
const delimiterOptions = [
  { value: ";", label: "Semicolon (;)" },
  { value: ",", label: "Comma (,)" },
  { value: "tab", label: "Tab" }
] as const;

export default function PtouchExportPage() {
  const { language, t } = useAppLanguage();
  const tr = (de: string, en: string) => (language === "en" ? en : de);
  const [mode, setMode] = useState<ExportMode>("all");
  const [delimiter, setDelimiter] = useState<(typeof delimiterOptions)[number]["value"]>(";");

  const downloadHref = useMemo(() => `/api/export/ptouch?mode=${mode}&delimiter=${encodeURIComponent(delimiter)}`, [delimiter, mode]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("navPtouchExport")}</h1>
          <p className="text-sm text-workshop-700">
            {tr(
              "Exportiert eine CSV fuer P-touch Labels mit URL und sichtbarem Labelnamen.",
              "Exports a CSV for P-touch labels with URL and visible label name."
            )}
          </p>
        </div>
        <Link className="btn-secondary" href="/admin">
          {tr("Zurueck zu Admin", "Back to Admin")}
        </Link>
      </div>

      <section className="card space-y-4">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{tr("Zu exportierende Labels", "Labels to export")}</h2>
          <p className="text-sm text-workshop-700">
            {tr(
              'Shelfs exportieren "Shelf-URL; Shelf-Label" wie `AA`. Drawer exportieren "Drawer-URL; Drawer-Label" wie `AB02`.',
              'Shelves export "shelf URL; shelf label" like `AA`. Drawers export "drawer URL; drawer label" like `AB02`.'
            )}
          </p>
        </div>

        <label className="block max-w-xs space-y-1 text-sm">
          <span>{tr("CSV-Trennzeichen", "CSV delimiter")}</span>
          <select className="input" value={delimiter} onChange={(event) => setDelimiter(event.target.value as (typeof delimiterOptions)[number]["value"])}>
            {delimiterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 md:grid-cols-3">
          <label className={`rounded-xl border p-4 ${mode === "all" ? "border-workshop-600 bg-workshop-50" : "border-workshop-200"}`}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="ptouch-mode"
                checked={mode === "all"}
                onChange={() => setMode("all")}
              />
              <div>
                <p className="font-medium">{tr("Alle Labels", "All labels")}</p>
                <p className="text-sm text-workshop-700">
                  {tr("Shelfs und Drawer gemeinsam in einer CSV.", "Shelves and drawers together in one CSV.")}
                </p>
              </div>
            </div>
          </label>

          <label className={`rounded-xl border p-4 ${mode === "shelves" ? "border-workshop-600 bg-workshop-50" : "border-workshop-200"}`}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="ptouch-mode"
                checked={mode === "shelves"}
                onChange={() => setMode("shelves")}
              />
              <div>
                <p className="font-medium">{tr("Nur Shelfs", "Shelves only")}</p>
                <p className="text-sm text-workshop-700">
                  {tr("Jede Zeile enthaelt Shelf-URL und Shelf-Code wie `AA`.", "Each row contains shelf URL and shelf code like `AA`.")}
                </p>
              </div>
            </div>
          </label>

          <label className={`rounded-xl border p-4 ${mode === "drawers" ? "border-workshop-600 bg-workshop-50" : "border-workshop-200"}`}>
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="ptouch-mode"
                checked={mode === "drawers"}
                onChange={() => setMode("drawers")}
              />
              <div>
                <p className="font-medium">{tr("Nur Drawer", "Drawers only")}</p>
                <p className="text-sm text-workshop-700">
                  {tr("Jede Zeile enthaelt Drawer-URL und Drawer-Label wie `AB02`.", "Each row contains drawer URL and drawer label like `AB02`.")}
                </p>
              </div>
            </div>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <a className="btn" href={downloadHref}>
            {tr("CSV herunterladen", "Download CSV")}
          </a>
        </div>
      </section>
    </div>
  );
}
