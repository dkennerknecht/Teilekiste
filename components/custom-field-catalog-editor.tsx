"use client";

import type { CustomFieldCatalogEntry } from "@/lib/custom-fields";

type Labels = {
  value: string;
  aliases: string;
  order: string;
  add: string;
  remove: string;
  empty: string;
  aliasesPlaceholder: string;
};

type Props = {
  entries: CustomFieldCatalogEntry[];
  onChange: (next: CustomFieldCatalogEntry[]) => void;
  labels: Labels;
};

function normalizeEntries(entries: CustomFieldCatalogEntry[]) {
  return entries.map((entry, index) => ({
    value: entry.value,
    aliases: entry.aliases,
    sortOrder: Number.isFinite(entry.sortOrder) ? entry.sortOrder : index
  }));
}

export function CustomFieldCatalogEditor({ entries, onChange, labels }: Props) {
  const normalizedEntries = normalizeEntries(entries);

  function updateEntry(index: number, patch: Partial<CustomFieldCatalogEntry>) {
    onChange(
      normalizedEntries.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              ...patch
            }
          : entry
      )
    );
  }

  function removeEntry(index: number) {
    onChange(normalizedEntries.filter((_, entryIndex) => entryIndex !== index));
  }

  function addEntry() {
    onChange([
      ...normalizedEntries,
      {
        value: "",
        aliases: [],
        sortOrder: normalizedEntries.length
      }
    ]);
  }

  return (
    <div className="space-y-2 rounded-lg border border-workshop-200 p-3">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto]">
        <div className="text-xs font-medium uppercase tracking-wide text-workshop-700">{labels.value}</div>
        <div className="text-xs font-medium uppercase tracking-wide text-workshop-700">{labels.aliases}</div>
        <div className="text-xs font-medium uppercase tracking-wide text-workshop-700">{labels.order}</div>
        <div />
      </div>
      {normalizedEntries.length === 0 ? <p className="text-sm text-workshop-700">{labels.empty}</p> : null}
      {normalizedEntries.map((entry, index) => (
        <div key={`${index}-${entry.sortOrder}`} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto]">
          <input
            className="input min-w-0"
            value={entry.value}
            onChange={(e) => updateEntry(index, { value: e.target.value })}
          />
          <input
            className="input min-w-0"
            value={entry.aliases.join(", ")}
            placeholder={labels.aliasesPlaceholder}
            onChange={(e) =>
              updateEntry(index, {
                aliases: e.target.value
                  .split(",")
                  .map((alias) => alias.trim())
                  .filter(Boolean)
              })
            }
          />
          <input
            className="input"
            type="number"
            min={0}
            value={entry.sortOrder}
            onChange={(e) => updateEntry(index, { sortOrder: Number(e.target.value) })}
          />
          <button type="button" className="btn-secondary" onClick={() => removeEntry(index)}>
            {labels.remove}
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={addEntry}>
        {labels.add}
      </button>
    </div>
  );
}
