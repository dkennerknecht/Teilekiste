"use client";

import { CustomFieldCatalogEditor } from "@/components/custom-field-catalog-editor";
import type { CustomFieldCatalogEntry } from "@/lib/custom-fields";
import type { CustomFieldPresetField } from "@/lib/custom-field-presets";

type CatalogLabels = {
  value: string;
  aliases: string;
  order: string;
  add: string;
  remove: string;
  empty: string;
  aliasesPlaceholder: string;
};

type Labels = {
  key: string;
  name: string;
  type: string;
  unit: string;
  required: string;
  order: string;
  addField: string;
  removeField: string;
  empty: string;
  keyPlaceholder: string;
  namePlaceholder: string;
  unitPlaceholder: string;
  catalog: string;
};

type Props = {
  fields: CustomFieldPresetField[];
  onChange: (next: CustomFieldPresetField[]) => void;
  labels: Labels;
  catalogLabels: CatalogLabels;
};

const fieldTypeOptions: CustomFieldPresetField["type"][] = [
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "DATE"
];

function supportsCatalog(type: CustomFieldPresetField["type"]) {
  return type === "TEXT" || type === "SELECT" || type === "MULTI_SELECT";
}

function normalizeCatalog(entries: CustomFieldCatalogEntry[] | undefined | null) {
  return (entries || []).map((entry, index) => ({
    value: entry.value,
    aliases: entry.aliases || [],
    sortOrder: Number.isFinite(entry.sortOrder) ? entry.sortOrder : index
  }));
}

function normalizeFields(fields: CustomFieldPresetField[]) {
  return fields.map((field, index) => ({
    key: field.key || "",
    name: field.name || "",
    type: field.type || "TEXT",
    unit: field.unit || "",
    required: !!field.required,
    sortOrder: Number.isFinite(field.sortOrder) ? field.sortOrder : index * 10,
    valueCatalog: normalizeCatalog(field.valueCatalog)
  }));
}

export function TechnicalFieldPresetFieldsEditor({ fields, onChange, labels, catalogLabels }: Props) {
  const normalizedFields = normalizeFields(fields);

  function updateField(index: number, patch: Partial<CustomFieldPresetField>) {
    onChange(
      normalizedFields.map((field, fieldIndex) =>
        fieldIndex === index
          ? {
              ...field,
              ...patch
            }
          : field
      )
    );
  }

  function removeField(index: number) {
    onChange(normalizedFields.filter((_, fieldIndex) => fieldIndex !== index));
  }

  function addField() {
    const nextIndex = normalizedFields.length;
    onChange([
      ...normalizedFields,
      {
        key: "",
        name: "",
        type: "TEXT",
        unit: "",
        required: false,
        sortOrder: nextIndex * 10,
        valueCatalog: []
      }
    ]);
  }

  return (
    <div className="space-y-3">
      {normalizedFields.length === 0 ? <p className="text-sm text-workshop-700">{labels.empty}</p> : null}
      {normalizedFields.map((field, index) => (
        <div key={`${index}-${field.key}`} className="space-y-3 rounded-lg border border-workshop-200 p-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[12rem_minmax(0,1fr)_10rem_10rem_7rem_auto]">
            <input
              className="input min-w-0"
              value={field.key}
              placeholder={labels.keyPlaceholder}
              onChange={(e) => updateField(index, { key: e.target.value })}
            />
            <input
              className="input min-w-0"
              value={field.name}
              placeholder={labels.namePlaceholder}
              onChange={(e) => updateField(index, { name: e.target.value })}
            />
            <select
              className="input"
              value={field.type}
              onChange={(e) =>
                updateField(index, {
                  type: e.target.value as CustomFieldPresetField["type"],
                  valueCatalog: supportsCatalog(e.target.value as CustomFieldPresetField["type"]) ? field.valueCatalog : []
                })
              }
            >
              {fieldTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              className="input min-w-0"
              value={field.unit || ""}
              placeholder={labels.unitPlaceholder}
              onChange={(e) => updateField(index, { unit: e.target.value })}
            />
            <input
              className="input"
              type="number"
              min={0}
              value={field.sortOrder}
              onChange={(e) => updateField(index, { sortOrder: Number(e.target.value) })}
            />
            <button type="button" className="btn-secondary" onClick={() => removeField(index)}>
              {labels.removeField}
            </button>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-workshop-800">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => updateField(index, { required: e.target.checked })}
            />
            {labels.required}
          </label>

          {supportsCatalog(field.type) ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-workshop-700">{labels.catalog}</p>
              <CustomFieldCatalogEditor
                entries={normalizeCatalog(field.valueCatalog)}
                onChange={(next) => updateField(index, { valueCatalog: next })}
                labels={catalogLabels}
              />
            </div>
          ) : null}
        </div>
      ))}

      <button type="button" className="btn-secondary" onClick={addField}>
        {labels.addField}
      </button>
    </div>
  );
}
