"use client";

import { useMemo, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";
import {
  isManagedCustomField,
  type CustomFieldRow,
  type CustomFieldValueMap,
  filterApplicableCustomFields,
  parseCustomFieldOptions
} from "@/lib/custom-fields";

type Props = {
  fields: CustomFieldRow[];
  values: CustomFieldValueMap;
  onChange: (next: CustomFieldValueMap) => void;
  categoryId?: string | null;
  typeId?: string | null;
  disabled?: boolean;
};

export function CustomFieldsEditor({ fields, values, onChange, categoryId, typeId, disabled }: Props) {
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const { language } = useAppLanguage();
  const tr = (de: string, en: string) => (language === "en" ? en : de);
  const applicableFields = useMemo(
    () =>
      filterApplicableCustomFields(fields, categoryId, typeId).sort(
        (left, right) => (left.sortOrder || 0) - (right.sortOrder || 0) || left.name.localeCompare(right.name, "de")
      ),
    [fields, categoryId, typeId]
  );
  const technicalFields = applicableFields.filter((field) => isManagedCustomField(field));
  const freeCustomFields = applicableFields.filter((field) => !isManagedCustomField(field));

  async function loadSuggestions(fieldId: string, query: string) {
    const res = await fetch(`/api/custom-fields/suggestions?fieldId=${fieldId}&q=${encodeURIComponent(query)}`, {
      cache: "no-store"
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (!data?.suggestions) return;
    setSuggestions((prev) => ({ ...prev, [fieldId]: data.suggestions }));
  }

  function setValue(fieldId: string, value: unknown) {
    onChange({
      ...values,
      [fieldId]: value
    });
  }

  if (!applicableFields.length) return null;

  function renderField(field: CustomFieldRow) {
    const options = parseCustomFieldOptions(field);
    const rawValue = values[field.id];
    const datalistId = `custom-field-${field.id}`;
    const label = field.unit ? `${field.name} (${field.unit})` : field.name;

    if (field.type === "BOOLEAN") {
      return (
        <label key={field.id} className="inline-flex items-center gap-2 rounded-lg border border-workshop-200 px-3 py-3">
          <input
            type="checkbox"
            checked={Boolean(rawValue)}
            disabled={disabled}
            onChange={(e) => setValue(field.id, e.target.checked)}
          />
          <span>{label}</span>
        </label>
      );
    }

    if (field.type === "SELECT") {
      const value = typeof rawValue === "string" ? rawValue : "";
      const renderedOptions = value && !options.includes(value) ? [value, ...options] : options;
      return (
        <label key={field.id} className="text-sm">
          {label}
          <select
            className="input mt-1"
            value={value}
            disabled={disabled}
            required={Boolean(field.required)}
            onChange={(e) => setValue(field.id, e.target.value)}
          >
            <option value="">{tr("Bitte waehlen", "Please choose")}</option>
            {renderedOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.type === "MULTI_SELECT") {
      const selectedValues = Array.isArray(rawValue) ? rawValue.map((entry) => String(entry)) : [];
      return (
        <fieldset key={field.id} className="rounded-lg border border-workshop-200 p-3">
          <legend className="px-1 text-sm font-medium">{label}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map((option) => (
              <label key={option} className="inline-flex items-center gap-2 rounded-full border border-workshop-200 px-3 py-1.5">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  disabled={disabled}
                  onChange={(e) => {
                    const nextValues = e.target.checked
                      ? [...selectedValues, option]
                      : selectedValues.filter((entry) => entry !== option);
                    setValue(field.id, nextValues);
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }

    if (field.type === "DATE") {
      return (
        <label key={field.id} className="text-sm">
          {label}
          <input
            className="input mt-1"
            type="date"
            value={typeof rawValue === "string" ? rawValue : ""}
            disabled={disabled}
            required={Boolean(field.required)}
            onChange={(e) => setValue(field.id, e.target.value)}
          />
        </label>
      );
    }

    if (field.type === "NUMBER") {
      const numberValue = typeof rawValue === "number" || typeof rawValue === "string" ? rawValue : "";
      return (
        <label key={field.id} className="text-sm">
          {field.name}
          <div className="mt-1 flex items-center gap-2">
            <input
              className="input flex-1"
              type="number"
              step="any"
              value={numberValue}
              disabled={disabled}
              required={Boolean(field.required)}
              onChange={(e) => setValue(field.id, e.target.value)}
            />
            {field.unit && <span className="theme-muted whitespace-nowrap text-sm">{field.unit}</span>}
          </div>
        </label>
      );
    }

    return (
      <label key={field.id} className="text-sm">
        {field.name}
        <div className="mt-1 flex items-center gap-2">
          <input
            className="input flex-1"
            type="text"
            list={suggestions[field.id]?.length ? datalistId : undefined}
            value={typeof rawValue === "string" ? rawValue : ""}
            disabled={disabled}
            required={Boolean(field.required)}
            onFocus={() => {
              void loadSuggestions(field.id, typeof rawValue === "string" ? rawValue : "");
            }}
            onChange={(e) => {
              setValue(field.id, e.target.value);
              void loadSuggestions(field.id, e.target.value);
            }}
          />
          {field.unit && <span className="theme-muted whitespace-nowrap text-sm">{field.unit}</span>}
        </div>
        {suggestions[field.id]?.length ? (
          <datalist id={datalistId}>
            {suggestions[field.id].map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        ) : null}
      </label>
    );
  }

  function renderSection(title: string, sectionFields: CustomFieldRow[]) {
    if (!sectionFields.length) return null;
    return (
      <fieldset className="text-sm md:col-span-2">
        <legend className="mb-2 font-medium">{title}</legend>
        <div className="grid gap-3 md:grid-cols-2">{sectionFields.map((field) => renderField(field))}</div>
      </fieldset>
    );
  }

  return (
    <div className="space-y-4 md:col-span-2">
      {renderSection(tr("Technical Field Set", "Technical Field Set"), technicalFields)}
      {renderSection(tr("Custom Fields", "Custom Fields"), freeCustomFields)}
    </div>
  );
}
