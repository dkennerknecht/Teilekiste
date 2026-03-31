"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { reorderCustomFieldCatalogEntries, type CustomFieldCatalogEntry } from "@/lib/custom-fields";

type Labels = {
  move: string;
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
  return entries
    .map((entry, index) => ({
      value: entry.value,
      aliases: entry.aliases,
      sortOrder: Number.isFinite(entry.sortOrder) ? entry.sortOrder : index
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.value.localeCompare(right.value, "de"));
}

export function CustomFieldCatalogEditor({ entries, onChange, labels }: Props) {
  const normalizedEntries = normalizeEntries(entries);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

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

  function moveEntry(fromIndex: number, toIndex: number) {
    onChange(reorderCustomFieldCatalogEntries(normalizedEntries, fromIndex, toIndex));
    setDraggedIndex(null);
    setDropIndex(null);
  }

  return (
    <div className="space-y-2 rounded-lg border border-workshop-200 p-3">
      <div className="grid gap-2 md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)_7rem_auto]">
        <div className="text-xs font-medium uppercase tracking-wide text-workshop-700">{labels.move}</div>
        <div className="text-xs font-medium uppercase tracking-wide text-workshop-700">{labels.value}</div>
        <div className="text-xs font-medium uppercase tracking-wide text-workshop-700">{labels.aliases}</div>
        <div className="text-xs font-medium uppercase tracking-wide text-workshop-700">{labels.order}</div>
        <div />
      </div>
      {normalizedEntries.length === 0 ? <p className="text-sm text-workshop-700">{labels.empty}</p> : null}
      {normalizedEntries.map((entry, index) => (
        <div
          key={`${index}-${entry.sortOrder}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (draggedIndex !== index) setDropIndex(index);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedIndex !== null) moveEntry(draggedIndex, index);
          }}
          className={`grid gap-2 rounded-md md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)_7rem_auto] ${
            dropIndex === index ? "bg-workshop-100 ring-1 ring-workshop-300" : ""
          }`}
        >
          <button
            type="button"
            draggable
            onDragStart={() => setDraggedIndex(index)}
            onDragEnd={() => {
              setDraggedIndex(null);
              setDropIndex(null);
            }}
            className="btn-secondary flex h-11 w-10 cursor-grab items-center justify-center px-0 py-0 active:cursor-grabbing"
            title={labels.move}
            aria-label={labels.move}
          >
            <GripVertical size={18} />
          </button>
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
