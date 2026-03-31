"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PencilLine, Trash2 } from "lucide-react";
import { CustomFieldCatalogEditor } from "@/components/custom-field-catalog-editor";
import { TechnicalFieldPresetFieldsEditor } from "@/components/technical-field-preset-fields-editor";
import { translateApiErrorMessage } from "@/lib/app-language";
import {
  isManagedCustomField,
  parseCustomFieldValueCatalog,
  type CustomFieldCatalogEntry,
  type CustomFieldRow
} from "@/lib/custom-fields";
import type { CustomFieldPresetField } from "@/lib/custom-field-presets";
import { useAppLanguage } from "@/components/app-language-provider";

type IdObj = { id: string };

type CustomFieldFormState = {
  name: string;
  type: string;
  unit: string;
  valueCatalog: CustomFieldCatalogEntry[];
  sortOrder: number;
  categoryId: string;
  typeId: string;
  required: boolean;
};

type TechnicalFieldAssignmentRow = {
  id: string;
  categoryId: string;
  typeId: string;
  presetKey: string;
  category: { id: string; name: string; code?: string | null };
  labelType: { id: string; name: string; code: string };
  preset: { key: string; name: string };
  managedFieldCount: number;
  activeManagedFieldCount: number;
};

type TechnicalFieldPresetRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  fields: CustomFieldPresetField[];
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
};

type TechnicalFieldPresetFormState = {
  key: string;
  name: string;
  description: string;
  fields: CustomFieldPresetField[];
};

function createEmptyCustomFieldFormState(): CustomFieldFormState {
  return {
    name: "",
    type: "TEXT",
    unit: "",
    valueCatalog: [],
    sortOrder: 0,
    categoryId: "",
    typeId: "",
    required: false
  };
}

function createEmptyTechnicalFieldPresetFormState(): TechnicalFieldPresetFormState {
  return {
    key: "",
    name: "",
    description: "",
    fields: [
      {
        key: "",
        name: "",
        type: "TEXT",
        unit: "",
        required: false,
        sortOrder: 0,
        valueCatalog: []
      }
    ]
  };
}

function supportsCatalog(type: string) {
  return type === "TEXT" || type === "SELECT" || type === "MULTI_SELECT";
}

function sortCustomFields<T extends CustomFieldRow>(rows: T[]) {
  return [...rows].sort(
    (a, b) =>
      Number(b.isActive !== false) - Number(a.isActive !== false) ||
      (a.sortOrder || 0) - (b.sortOrder || 0) ||
      String(a.name || "").localeCompare(String(b.name || ""), "de") ||
      String(a.key || "").localeCompare(String(b.key || ""), "de")
  );
}

function sortTechnicalFieldPresets<T extends TechnicalFieldPresetRow>(rows: T[]) {
  return [...rows].sort(
    (a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "de") ||
      String(a.key || "").localeCompare(String(b.key || ""), "de")
  );
}

function replaceById<T extends IdObj>(rows: T[], nextRow: T) {
  return rows.map((row) => (row.id === nextRow.id ? { ...row, ...nextRow } : row));
}

function removeById<T extends IdObj>(rows: T[], id: string) {
  return rows.filter((row) => row.id !== id);
}

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

export default function AdminFieldsPage() {
  const { language } = useAppLanguage();
  const tr = (de: string, en: string) => (language === "en" ? en : de);
  const unknownError = tr("Unbekannt", "Unknown");
  const apiError = (data: any) => translateApiErrorMessage(language, data?.error) || data?.error || unknownError;

  const [categories, setCategories] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([]);
  const [technicalFieldPresets, setTechnicalFieldPresets] = useState<TechnicalFieldPresetRow[]>([]);
  const [technicalFieldAssignments, setTechnicalFieldAssignments] = useState<TechnicalFieldAssignmentRow[]>([]);
  const [technicalAssignmentPresetDrafts, setTechnicalAssignmentPresetDrafts] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string>("");
  const [editCustomId, setEditCustomId] = useState<string | null>(null);
  const [editCustom, setEditCustom] = useState<CustomFieldFormState>(createEmptyCustomFieldFormState);
  const [newCustom, setNewCustom] = useState<CustomFieldFormState>(createEmptyCustomFieldFormState);
  const [editTechnicalPresetId, setEditTechnicalPresetId] = useState<string | null>(null);
  const [editTechnicalPreset, setEditTechnicalPreset] = useState<TechnicalFieldPresetFormState>(createEmptyTechnicalFieldPresetFormState);
  const [newTechnicalPreset, setNewTechnicalPreset] = useState<TechnicalFieldPresetFormState>(createEmptyTechnicalFieldPresetFormState);
  const [newTechnicalAssignment, setNewTechnicalAssignment] = useState({
    categoryId: "",
    typeId: "",
    presetKey: ""
  });
  const editableCustomFields = customFields.filter((field) => !isManagedCustomField(field));

  const catalogEditorLabels = {
    move: tr("Ziehen", "Drag"),
    value: tr("Wert", "Value"),
    aliases: tr("Aliase", "Aliases"),
    order: tr("Reihenfolge", "Order"),
    add: tr("Wert hinzufuegen", "Add value"),
    remove: tr("Entfernen", "Remove"),
    empty: tr("Noch keine Katalogwerte definiert.", "No catalog values defined yet."),
    aliasesPlaceholder: tr("Alias 1, Alias 2", "Alias 1, Alias 2")
  };

  const technicalPresetFieldLabels = {
    key: tr("Feld-Key", "Field key"),
    name: tr("Feldname", "Field name"),
    type: tr("Typ", "Type"),
    unit: tr("Einheit", "Unit"),
    required: tr("Pflichtfeld", "Required field"),
    order: tr("Reihenfolge", "Order"),
    addField: tr("Feld hinzufuegen", "Add field"),
    removeField: tr("Feld entfernen", "Remove field"),
    empty: tr("Noch keine Felder definiert.", "No fields defined yet."),
    keyPlaceholder: tr("stabiler-key", "stable-key"),
    namePlaceholder: tr("Anzeigename", "Display name"),
    unitPlaceholder: tr("optional", "optional"),
    catalog: tr("Wertekatalog", "Value catalog")
  };

  const load = useCallback(async () => {
    const [c, ty, f, presets, assignments] = await Promise.all([
      fetch("/api/admin/categories", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/types", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/custom-fields", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/technical-field-presets", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/technical-field-assignments", { cache: "no-store" }).then((r) => r.json())
    ]);
    setCategories(c);
    setTypes(ty);
    setCustomFields(sortCustomFields(f));
    setTechnicalFieldPresets(
      [...(presets || [])].sort(
        (left: TechnicalFieldPresetRow, right: TechnicalFieldPresetRow) =>
          String(left.name || "").localeCompare(String(right.name || ""), "de") ||
          String(left.key || "").localeCompare(String(right.key || ""), "de")
      )
    );
    setTechnicalFieldAssignments(assignments);
    setTechnicalAssignmentPresetDrafts(
      Object.fromEntries((assignments as TechnicalFieldAssignmentRow[]).map((assignment) => [assignment.id, assignment.presetKey]))
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (categories.length && !newTechnicalAssignment.categoryId) {
      setNewTechnicalAssignment((current) => ({ ...current, categoryId: categories[0].id }));
    }
  }, [categories, newTechnicalAssignment.categoryId]);

  useEffect(() => {
    if (types.length && !newTechnicalAssignment.typeId) {
      setNewTechnicalAssignment((current) => ({ ...current, typeId: types[0].id }));
    }
  }, [types, newTechnicalAssignment.typeId]);

  useEffect(() => {
    if (!technicalFieldPresets.length) {
      if (newTechnicalAssignment.presetKey) {
        setNewTechnicalAssignment((current) => ({ ...current, presetKey: "" }));
      }
      return;
    }
    if (!newTechnicalAssignment.presetKey || !technicalFieldPresets.some((preset) => preset.key === newTechnicalAssignment.presetKey)) {
      setNewTechnicalAssignment((current) => ({ ...current, presetKey: technicalFieldPresets[0].key }));
    }
  }, [newTechnicalAssignment.presetKey, technicalFieldPresets]);

  async function apiJson(url: string, init: RequestInit) {
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      return { res, data };
    } catch (error) {
      return {
        res: { ok: false, status: 0 } as Response,
        data: { error: (error as Error).message || tr("Netzwerkfehler", "Network error") }
      };
    }
  }

  function describeCustomFieldScope(field: CustomFieldRow) {
    if (field.category && field.labelType) {
      return `${field.category.name} / ${field.labelType.code} - ${field.labelType.name}`;
    }
    if (field.category) return field.category.name;
    if (field.labelType) return `${field.labelType.code} - ${field.labelType.name}`;
    return tr("Alle Items", "All items");
  }

  function describeTechnicalFieldAssignmentScope(assignment: TechnicalFieldAssignmentRow) {
    return `${assignment.category.name} / ${assignment.labelType.code} - ${assignment.labelType.name}`;
  }

  function getPresetName(presetKey: string | null | undefined) {
    if (!presetKey) return tr("Unbekannt", "Unknown");
    return technicalFieldPresets.find((preset) => preset.key === presetKey)?.name || presetKey;
  }

  function getTechnicalFieldSyncCounts(data: {
    createdFieldIds?: string[];
    reactivatedFieldIds?: string[];
    deactivatedFieldIds?: string[];
  }) {
    return {
      created: data.createdFieldIds?.length || 0,
      reactivated: data.reactivatedFieldIds?.length || 0,
      deactivated: data.deactivatedFieldIds?.length || 0
    };
  }

  function summarizeCatalog(field: CustomFieldRow) {
    const catalog = parseCustomFieldValueCatalog(field);
    if (!catalog.length) return "";
    return catalog
      .map((entry) => (entry.aliases.length ? `${entry.value} (${entry.aliases.join(", ")})` : entry.value))
      .join(", ");
  }

  function startEditCustom(row: CustomFieldRow) {
    if (isManagedCustomField(row)) {
      setFeedback(
        tr(
          "Technische Felder werden ueber den verwalteten Feldsatz bearbeitet.",
          "Technical fields are managed through the technical field set."
        )
      );
      return;
    }
    setEditCustomId(row.id);
    setEditCustom({
      name: (row as any).name || "",
      type: (row as any).type || "TEXT",
      unit: (row as any).unit || "",
      valueCatalog: parseCustomFieldValueCatalog(row),
      sortOrder: (row as any).sortOrder || 0,
      categoryId: (row as any).categoryId || "",
      typeId: (row as any).typeId || "",
      required: !!(row as any).required
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{tr("Felder & Presets", "Fields & Presets")}</h1>
        <Link className="btn-secondary" href="/admin">
          {tr("Zurueck", "Back")}
        </Link>
      </div>
      {feedback && <div className="rounded border border-workshop-300 bg-workshop-100 p-2 text-sm">{feedback}</div>}

      <section className="card space-y-3">
        <h2 className="font-semibold">{tr("Technische Presets", "Technical presets")}</h2>
        <p className="theme-muted text-sm">
          {tr(
            "Definiert die verwalteten technischen Feldsaetze selbst. Diese Presets stehen danach unten fuer Kategorie-Type-Zuweisungen zur Verfuegung.",
            "Define the managed technical field sets themselves. These presets are then available below for category-type assignments."
          )}
        </p>

        <div className="space-y-3 rounded border border-workshop-200 p-3">
          <h3 className="font-medium">{tr("Neues technisches Preset", "New technical preset")}</h3>
          <div className="grid gap-2 md:grid-cols-[14rem_minmax(0,1fr)]">
            <input
              className="input min-w-0"
              value={newTechnicalPreset.key}
              placeholder={tr("preset-key", "preset-key")}
              onChange={(e) => setNewTechnicalPreset((current) => ({ ...current, key: e.target.value }))}
            />
            <input
              className="input min-w-0"
              value={newTechnicalPreset.name}
              placeholder={tr("Preset-Name", "Preset name")}
              onChange={(e) => setNewTechnicalPreset((current) => ({ ...current, name: e.target.value }))}
            />
          </div>
          <textarea
            className="input min-h-24"
            value={newTechnicalPreset.description}
            placeholder={tr("Beschreibung", "Description")}
            onChange={(e) => setNewTechnicalPreset((current) => ({ ...current, description: e.target.value }))}
          />
          <TechnicalFieldPresetFieldsEditor
            fields={newTechnicalPreset.fields}
            onChange={(fields) => setNewTechnicalPreset((current) => ({ ...current, fields }))}
            labels={technicalPresetFieldLabels}
            catalogLabels={catalogEditorLabels}
          />
          <button
            className="btn-secondary"
            type="button"
            onClick={async () => {
              const { res, data } = await apiJson("/api/admin/technical-field-presets", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(newTechnicalPreset)
              });
              setFeedback(
                res.ok
                  ? tr("Technisches Preset angelegt", "Technical preset created")
                  : tr(`Technisches Preset anlegen fehlgeschlagen: ${apiError(data)}`, `Technical preset creation failed: ${apiError(data)}`)
              );
              if (res.ok) {
                setTechnicalFieldPresets((current) => sortTechnicalFieldPresets([...(current as TechnicalFieldPresetRow[]), data as TechnicalFieldPresetRow]));
                setNewTechnicalPreset(createEmptyTechnicalFieldPresetFormState());
              }
            }}
          >
            {tr("Preset anlegen", "Create preset")}
          </button>
        </div>

        <ul className="space-y-2 text-sm">
          {technicalFieldPresets.map((preset) => (
            <li key={preset.id} className="rounded border border-workshop-200 p-3">
              {editTechnicalPresetId === preset.id ? (
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-[14rem_minmax(0,1fr)]">
                    <input className="input min-w-0" value={preset.key} disabled />
                    <input
                      className="input min-w-0"
                      value={editTechnicalPreset.name}
                      onChange={(e) => setEditTechnicalPreset((current) => ({ ...current, name: e.target.value }))}
                    />
                  </div>
                  <textarea
                    className="input min-h-24"
                    value={editTechnicalPreset.description}
                    onChange={(e) => setEditTechnicalPreset((current) => ({ ...current, description: e.target.value }))}
                  />
                  <TechnicalFieldPresetFieldsEditor
                    fields={editTechnicalPreset.fields}
                    onChange={(fields) => setEditTechnicalPreset((current) => ({ ...current, fields }))}
                    labels={technicalPresetFieldLabels}
                    catalogLabels={catalogEditorLabels}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={async () => {
                        const { res, data } = await apiJson("/api/admin/technical-field-presets", {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            id: preset.id,
                            name: editTechnicalPreset.name,
                            description: editTechnicalPreset.description,
                            fields: editTechnicalPreset.fields
                          })
                        });
                        setFeedback(
                          res.ok
                            ? tr("Technisches Preset aktualisiert", "Technical preset updated")
                            : tr(`Technisches Preset Update fehlgeschlagen: ${apiError(data)}`, `Technical preset update failed: ${apiError(data)}`)
                        );
                        if (res.ok) {
                          setTechnicalFieldPresets((current) =>
                            sortTechnicalFieldPresets(replaceById(current as TechnicalFieldPresetRow[], data as TechnicalFieldPresetRow))
                          );
                          setEditTechnicalPresetId(null);
                          setEditTechnicalPreset(createEmptyTechnicalFieldPresetFormState());
                        }
                      }}
                    >
                      {tr("Speichern", "Save")}
                    </button>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => {
                        setEditTechnicalPresetId(null);
                        setEditTechnicalPreset(createEmptyTechnicalFieldPresetFormState());
                      }}
                    >
                      {tr("Abbrechen", "Cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{preset.name} <span className="theme-muted font-mono text-xs">({preset.key})</span></p>
                    {preset.description ? <p className="theme-muted text-xs">{preset.description}</p> : null}
                    <p className="theme-muted text-xs">
                      {preset.fields.map((field) => `${field.name} [${field.type}]`).join(" • ")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => {
                        setEditTechnicalPresetId(preset.id);
                        setEditTechnicalPreset({
                          key: preset.key,
                          name: preset.name,
                          description: preset.description || "",
                          fields: preset.fields
                        });
                      }}
                    >
                      {tr("Bearbeiten", "Edit")}
                    </button>
                    <button
                      className="btn-secondary"
                      type="button"
                      disabled={preset.assignmentCount > 0}
                      onClick={async () => {
                        const { res, data } = await apiJson("/api/admin/technical-field-presets", {
                          method: "DELETE",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ id: preset.id })
                        });
                        setFeedback(
                          res.ok
                            ? tr("Technisches Preset geloescht", "Technical preset deleted")
                            : tr(`Technisches Preset Loeschen fehlgeschlagen: ${apiError(data)}`, `Technical preset delete failed: ${apiError(data)}`)
                        );
                        if (res.ok) setTechnicalFieldPresets((current) => removeById(current as TechnicalFieldPresetRow[], preset.id));
                      }}
                    >
                      {tr("Loeschen", "Delete")}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {technicalFieldPresets.length === 0 ? (
            <li className="rounded border border-dashed border-workshop-200 p-3 text-workshop-700">
              {tr("Noch keine technischen Presets vorhanden.", "No technical presets yet.")}
            </li>
          ) : null}
        </ul>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">{tr("Technische Feldsaetze zuweisen", "Assign technical field sets")}</h2>
        <p className="theme-muted text-sm">
          {tr(
            "Weist einer festen Kategorie-Type-Kombination genau einen verwalteten technischen Feldsatz zu. Beim Wechsel werden neue Felder synchronisiert und alte technische Felder nur deaktiviert.",
            "Assign exactly one managed technical field set to a category-type combination. Switching synchronizes new fields and only deactivates old technical fields."
          )}
        </p>
        <form
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            const { res, data } = await apiJson("/api/admin/technical-field-assignments", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(newTechnicalAssignment)
            });
            const syncCounts = getTechnicalFieldSyncCounts(data);
            setFeedback(
              res.ok
                ? tr(
                    `Technischer Feldsatz synchronisiert: ${syncCounts.created} neu, ${syncCounts.reactivated} reaktiviert, ${syncCounts.deactivated} deaktiviert`,
                    `Technical field set synchronized: ${syncCounts.created} created, ${syncCounts.reactivated} reactivated, ${syncCounts.deactivated} deactivated`
                  )
                : tr(
                    `Technischer Feldsatz fehlgeschlagen: ${apiError(data)}`,
                    `Technical field set failed: ${apiError(data)}`
                  )
            );
            if (res.ok) await load();
          }}
        >
          <select
            className="input"
            value={newTechnicalAssignment.categoryId}
            onChange={(e) => setNewTechnicalAssignment((current) => ({ ...current, categoryId: e.target.value }))}
            disabled={!categories.length}
            required
          >
            {categories.length === 0 ? (
              <option value="">{tr("Erst Kategorie anlegen", "Create category first")}</option>
            ) : (
              categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.code || "--"})
                </option>
              ))
            )}
          </select>
          <select
            className="input"
            value={newTechnicalAssignment.typeId}
            onChange={(e) => setNewTechnicalAssignment((current) => ({ ...current, typeId: e.target.value }))}
            disabled={!types.length}
            required
          >
            {types.length === 0 ? (
              <option value="">{tr("Erst Type anlegen", "Create type first")}</option>
            ) : (
              types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.code} - {type.name}
                </option>
              ))
            )}
          </select>
          <select
            className="input"
            value={newTechnicalAssignment.presetKey}
            onChange={(e) => setNewTechnicalAssignment((current) => ({ ...current, presetKey: e.target.value }))}
            disabled={!technicalFieldPresets.length}
            required
          >
            {technicalFieldPresets.length === 0 ? (
              <option value="">{tr("Erst technisches Preset anlegen", "Create a technical preset first")}</option>
            ) : (
              technicalFieldPresets.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.name}
                </option>
              ))
            )}
          </select>
          <button
            className="btn-secondary"
            type="submit"
            disabled={!newTechnicalAssignment.categoryId || !newTechnicalAssignment.typeId || !newTechnicalAssignment.presetKey}
          >
            {tr("Feldsatz zuweisen", "Assign field set")}
          </button>
        </form>
        <ul className="space-y-2 text-sm">
          {technicalFieldAssignments.map((assignment) => (
            <li key={assignment.id} className="rounded border border-workshop-200 p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{describeTechnicalFieldAssignmentScope(assignment)}</p>
                  <p className="theme-muted text-xs">
                    {tr("Aktueller Feldsatz", "Current field set")}: {getPresetName(assignment.presetKey)}
                    {` • ${assignment.activeManagedFieldCount}/${assignment.managedFieldCount} ${tr("aktive technische Felder", "active technical fields")}`}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className="input min-w-0 sm:min-w-[15rem]"
                    value={technicalAssignmentPresetDrafts[assignment.id] || assignment.presetKey}
                    onChange={(e) =>
                      setTechnicalAssignmentPresetDrafts((current) => ({
                        ...current,
                        [assignment.id]: e.target.value
                      }))
                    }
                  >
                    {technicalFieldPresets.map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={async () => {
                      const { res, data } = await apiJson("/api/admin/technical-field-assignments", {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          id: assignment.id,
                          categoryId: assignment.categoryId,
                          typeId: assignment.typeId,
                          presetKey: technicalAssignmentPresetDrafts[assignment.id] || assignment.presetKey
                        })
                      });
                      const syncCounts = getTechnicalFieldSyncCounts(data);
                      setFeedback(
                        res.ok
                          ? tr(
                              `Technischer Feldsatz aktualisiert: ${syncCounts.created} neu, ${syncCounts.reactivated} reaktiviert, ${syncCounts.deactivated} deaktiviert`,
                              `Technical field set updated: ${syncCounts.created} created, ${syncCounts.reactivated} reactivated, ${syncCounts.deactivated} deactivated`
                            )
                          : tr(
                              `Technischer Feldsatz Update fehlgeschlagen: ${apiError(data)}`,
                              `Technical field set update failed: ${apiError(data)}`
                            )
                      );
                      if (res.ok) await load();
                    }}
                  >
                    {tr("Speichern", "Save")}
                  </button>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={async () => {
                      const { res, data } = await apiJson("/api/admin/technical-field-assignments", {
                        method: "DELETE",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ id: assignment.id })
                      });
                      setFeedback(
                        res.ok
                          ? tr("Technischer Feldsatz entfernt", "Technical field set removed")
                          : tr(
                              `Technischer Feldsatz Entfernen fehlgeschlagen: ${apiError(data)}`,
                              `Technical field set delete failed: ${apiError(data)}`
                            )
                      );
                      if (res.ok) await load();
                    }}
                  >
                    {tr("Entfernen", "Remove")}
                  </button>
                </div>
              </div>
            </li>
          ))}
          {technicalFieldAssignments.length === 0 ? (
            <li className="rounded border border-dashed border-workshop-200 p-3 text-workshop-700">
              {tr("Noch keine technischen Feldsaetze zugewiesen.", "No technical field sets assigned yet.")}
            </li>
          ) : null}
        </ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">{tr("Custom Fields", "Custom fields")}</h2>
        <ul className="space-y-2 text-sm">
          {editableCustomFields.map((f) => (
            <li key={f.id} className="rounded border border-workshop-200 p-3">
              {editCustomId === f.id ? (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_8rem]">
                    <input className="input min-w-0" value={editCustom.name} onChange={(e) => setEditCustom((v) => ({ ...v, name: e.target.value }))} placeholder={tr("Name", "Name")} />
                    <input className="input min-w-0" value={editCustom.unit} onChange={(e) => setEditCustom((v) => ({ ...v, unit: e.target.value }))} placeholder={tr("Einheit (optional)", "Unit (optional)")} />
                    <input className="input" type="number" min={0} value={editCustom.sortOrder} onChange={(e) => setEditCustom((v) => ({ ...v, sortOrder: Number(e.target.value) }))} placeholder={tr("Reihenfolge", "Order")} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <select
                      className="input"
                      value={editCustom.type}
                      onChange={(e) =>
                        setEditCustom((v) => ({
                          ...v,
                          type: e.target.value,
                          valueCatalog: supportsCatalog(e.target.value) ? v.valueCatalog : []
                        }))
                      }
                    >
                      <option>TEXT</option>
                      <option>NUMBER</option>
                      <option>BOOLEAN</option>
                      <option>SELECT</option>
                      <option>MULTI_SELECT</option>
                      <option>DATE</option>
                    </select>
                    <select className="input" value={editCustom.categoryId} onChange={(e) => setEditCustom((v) => ({ ...v, categoryId: e.target.value }))}>
                      <option value="">{tr("Alle Kategorien", "All categories")}</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name} ({category.code || "--"})
                        </option>
                      ))}
                    </select>
                    <select className="input" value={editCustom.typeId} onChange={(e) => setEditCustom((v) => ({ ...v, typeId: e.target.value }))}>
                      <option value="">{tr("Alle Types", "All types")}</option>
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
                      {tr("Pflichtfeld", "Required field")}
                    </label>
                  </div>
                  {supportsCatalog(editCustom.type) ? (
                    <CustomFieldCatalogEditor
                      entries={editCustom.valueCatalog}
                      onChange={(valueCatalog) => setEditCustom((v) => ({ ...v, valueCatalog }))}
                      labels={catalogEditorLabels}
                    />
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      className="btn-secondary"
                      onClick={async () => {
                        const { res, data } = await apiJson("/api/admin/custom-fields", {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            id: f.id,
                            name: editCustom.name,
                            type: editCustom.type,
                            unit: editCustom.unit || null,
                            sortOrder: editCustom.sortOrder,
                            categoryId: editCustom.categoryId || null,
                            typeId: editCustom.typeId || null,
                            required: editCustom.required,
                            valueCatalog: supportsCatalog(editCustom.type) ? editCustom.valueCatalog : null,
                            options: null
                          })
                        });
                        setFeedback(res.ok ? tr("Custom Field aktualisiert", "Custom field updated") : tr(`Custom Field Update fehlgeschlagen: ${data.error || unknownError}`, `Custom field update failed: ${data.error || unknownError}`));
                        if (res.ok) {
                          setCustomFields((prev) => sortCustomFields(replaceById(prev, data)));
                          setEditCustomId(null);
                          setEditCustom(createEmptyCustomFieldFormState());
                        }
                      }}
                    >
                      {tr("Speichern", "Save")}
                    </button>
                    <button className="btn-secondary" onClick={() => setEditCustomId(null)}>
                      {tr("Abbrechen", "Cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">
                        {f.name}
                        {f.unit ? ` (${f.unit})` : ""}
                      </span>
                      {isManagedCustomField(f) ? (
                        <span className="rounded bg-workshop-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-workshop-700">
                          {tr("Verwaltet", "Managed")}
                        </span>
                      ) : null}
                      {f.isActive === false ? (
                        <span className="rounded bg-workshop-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-workshop-700">
                          {tr("Inaktiv", "Inactive")}
                        </span>
                      ) : null}
                    </p>
                    <p className="theme-muted text-xs">
                      {f.type} • {describeCustomFieldScope(f)}
                      {` • ${tr("Pos", "Pos")} ${f.sortOrder || 0}`}
                      {f.required ? ` • ${tr("Pflicht", "Required")}` : ""}
                      {isManagedCustomField(f) ? ` • ${tr("Feldsatz", "Field set")} ${getPresetName(f.managedPresetKey)}` : ""}
                    </p>
                    {summarizeCatalog(f) ? (
                      <p className="theme-muted truncate text-xs">
                        {tr("Katalog", "Catalog")}: {summarizeCatalog(f)}
                      </p>
                    ) : null}
                  </div>
                  {isManagedCustomField(f) ? (
                    <p className="theme-muted max-w-48 text-right text-xs">
                      {tr(
                        "Bearbeitung und Entfernen laufen ueber den technischen Feldsatz.",
                        "Editing and removal are managed through the technical field set."
                      )}
                    </p>
                  ) : (
                    <div className="flex shrink-0 gap-2">
                      <IconActionButton label={tr("Custom Field bearbeiten", "Edit custom field")} onClick={() => startEditCustom(f)}>
                        <PencilLine size={20} />
                      </IconActionButton>
                      <IconActionButton
                        label={tr("Custom Field loeschen", "Delete custom field")}
                        onClick={async () => {
                          const { res, data } = await apiJson("/api/admin/custom-fields", {
                            method: "DELETE",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: f.id })
                          });
                          setFeedback(res.ok ? tr("Custom Field geloescht", "Custom field deleted") : tr(`Custom Field Loeschen fehlgeschlagen: ${data.error || unknownError}`, `Custom field delete failed: ${data.error || unknownError}`));
                          if (res.ok) setCustomFields((prev) => removeById(prev, f.id));
                        }}
                      >
                        <Trash2 size={20} />
                      </IconActionButton>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
          {editableCustomFields.length === 0 && (
            <li className="rounded border border-dashed border-workshop-200 p-3 text-workshop-700">
              {tr("Noch keine frei bearbeitbaren Custom Fields angelegt.", "No editable custom fields created yet.")}
            </li>
          )}
        </ul>
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const { res, data } = await apiJson("/api/admin/custom-fields", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name: newCustom.name,
                unit: newCustom.unit || null,
                type: newCustom.type,
                sortOrder: newCustom.sortOrder,
                categoryId: newCustom.categoryId || null,
                typeId: newCustom.typeId || null,
                required: newCustom.required,
                valueCatalog: supportsCatalog(newCustom.type) ? newCustom.valueCatalog : null,
                options: null
              })
            });
            setFeedback(res.ok ? tr("Custom Field angelegt", "Custom field created") : tr(`Custom Field anlegen fehlgeschlagen: ${data.error || unknownError}`, `Custom field creation failed: ${data.error || unknownError}`));
            if (res.ok) {
              setCustomFields((prev) => sortCustomFields([...(prev as CustomFieldRow[]), data as CustomFieldRow]));
              setNewCustom(createEmptyCustomFieldFormState());
            }
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_8rem]">
            <input className="input min-w-0" value={newCustom.name} onChange={(e) => setNewCustom((v) => ({ ...v, name: e.target.value }))} placeholder={tr("Name", "Name")} required />
            <input className="input min-w-0" value={newCustom.unit} onChange={(e) => setNewCustom((v) => ({ ...v, unit: e.target.value }))} placeholder={tr("Einheit (optional)", "Unit (optional)")} />
            <input className="input" type="number" min={0} value={newCustom.sortOrder} onChange={(e) => setNewCustom((v) => ({ ...v, sortOrder: Number(e.target.value) }))} placeholder={tr("Reihenfolge", "Order")} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <select
              className="input"
              value={newCustom.type}
              onChange={(e) =>
                setNewCustom((v) => ({
                  ...v,
                  type: e.target.value,
                  valueCatalog: supportsCatalog(e.target.value) ? v.valueCatalog : []
                }))
              }
            >
              <option>TEXT</option>
              <option>NUMBER</option>
              <option>BOOLEAN</option>
              <option>SELECT</option>
              <option>MULTI_SELECT</option>
              <option>DATE</option>
            </select>
            <select className="input" value={newCustom.categoryId} onChange={(e) => setNewCustom((v) => ({ ...v, categoryId: e.target.value }))}>
              <option value="">{tr("Alle Kategorien", "All categories")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.code || "--"})
                </option>
              ))}
            </select>
            <select className="input" value={newCustom.typeId} onChange={(e) => setNewCustom((v) => ({ ...v, typeId: e.target.value }))}>
              <option value="">{tr("Alle Types", "All types")}</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.code} - {type.name}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 rounded border border-workshop-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={newCustom.required} onChange={(e) => setNewCustom((v) => ({ ...v, required: e.target.checked }))} />
              {tr("Pflichtfeld", "Required field")}
            </label>
          </div>
          {supportsCatalog(newCustom.type) ? (
            <CustomFieldCatalogEditor
              entries={newCustom.valueCatalog}
              onChange={(valueCatalog) => setNewCustom((v) => ({ ...v, valueCatalog }))}
              labels={catalogEditorLabels}
            />
          ) : null}
          <button className="btn-secondary" type="submit">
            {tr("Anlegen", "Create")}
          </button>
        </form>
      </section>
    </div>
  );
}
