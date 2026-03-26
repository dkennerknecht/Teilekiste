"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { fileHref } from "@/lib/file-href";

type ItemImage = {
  id: string;
  path: string;
  thumbPath: string | null;
  caption: string | null;
  sortOrder: number;
};
type TagOption = { id: string; name: string };

export default function EditItemPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [images, setImages] = useState<ItemImage[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetch(`/api/items/${params.id}`, { cache: "no-store" }).then((r) => r.json());
    setForm({
      name: data.name,
      description: data.description,
      storageArea: data.storageArea || "",
      bin: data.bin || "",
      minStock: data.minStock ?? "",
      manufacturer: data.manufacturer || "",
      mpn: data.mpn || "",
      barcodeEan: data.barcodeEan || "",
      tagIds: (data.tags || []).map((t: any) => t.tagId)
    });
    setImages((data.images || []).slice().sort((a: ItemImage, b: ItemImage) => a.sortOrder - b.sortOrder));
  }, [params.id]);

  useEffect(() => {
    fetch("/api/meta", { cache: "no-store" })
      .then((r) => r.json())
      .then((meta) => setTags(meta.tags || []));
    load();
  }, [load]);

  const imageIds = useMemo(() => images.map((img) => img.id), [images]);

  async function persistOrder(nextImages: ItemImage[]) {
    setImages(nextImages);
    await fetch(`/api/items/${params.id}/images`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderedImageIds: nextImages.map((img) => img.id) })
    });
    await load();
  }

  if (!form) return <p>Lade...</p>;

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h1 className="text-xl font-semibold">Item bearbeiten</h1>

        <label className="text-sm">
          Name
          <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>

        <label className="text-sm">
          Hersteller
          <input className="input mt-1" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
        </label>

        <label className="text-sm">
          MPN
          <input className="input mt-1" value={form.mpn} onChange={(e) => setForm({ ...form, mpn: e.target.value })} />
        </label>

        <label className="text-sm">
          EAN
          <input className="input mt-1" value={form.barcodeEan} onChange={(e) => setForm({ ...form, barcodeEan: e.target.value })} />
        </label>

        <label className="text-sm">
          Regal
          <input className="input mt-1" value={form.storageArea} onChange={(e) => setForm({ ...form, storageArea: e.target.value })} />
        </label>

        <label className="text-sm">
          Fach
          <input className="input mt-1" value={form.bin} onChange={(e) => setForm({ ...form, bin: e.target.value })} />
        </label>

        <label className="text-sm">
          Mindestbestand
          <input
            className="input mt-1"
            type="number"
            value={form.minStock}
            onChange={(e) => setForm({ ...form, minStock: e.target.value })}
            placeholder="leer = kein Mindestbestand"
          />
        </label>

        <label className="text-sm">
          Beschreibung (Markdown)
          <textarea className="input mt-1 min-h-28" rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>

        <fieldset className="text-sm">
          <legend className="mb-1">Tags</legend>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <label key={tag.id} className="inline-flex items-center gap-1 rounded border border-workshop-200 px-2 py-1">
                <input
                  type="checkbox"
                  checked={form.tagIds.includes(tag.id)}
                  onChange={(e) =>
                    setForm((prev: any) => ({
                      ...prev,
                      tagIds: e.target.checked
                        ? [...new Set([...prev.tagIds, tag.id])]
                        : prev.tagIds.filter((id: string) => id !== tag.id)
                    }))
                  }
                />
                <span>{tag.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          className="btn"
          onClick={async () => {
            const payload = {
              ...form,
              minStock: form.minStock === "" ? null : Number(form.minStock)
            };
            const res = await fetch(`/api/items/${params.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload)
            });
            if (res.ok) {
              router.replace(`/items/${params.id}`);
              router.refresh();
            }
          }}
        >
          Speichern
        </button>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Bilder bearbeiten</h2>
        <p className="text-sm text-workshop-700">Erstes Bild ist automatisch das Titelbild. Reihenfolge per Drag&Drop ändern.</p>

        <form
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            await fetch(`/api/items/${params.id}/images`, { method: "POST", body: formData });
            e.currentTarget.reset();
            await load();
          }}
        >
          <input className="input" type="file" name="file" accept="image/*" capture="environment" required />
          <input className="input sm:flex-1" type="text" name="caption" placeholder="Bildtitel (optional)" />
          <button className="btn w-full sm:w-auto" type="submit">
            Bild hochladen
          </button>
        </form>

        {images.length === 0 ? (
          <p className="text-sm text-workshop-700">Noch keine Bilder vorhanden.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            {images.map((img, index) => (
              <div
                key={img.id}
                className={`min-w-0 rounded border p-2 sm:w-28 ${
                  dragOverId === img.id ? "border-workshop-700 bg-workshop-50" : "border-workshop-200"
                }`}
                draggable
                onDragStart={() => setDraggedId(img.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(img.id);
                }}
                onDragLeave={() => setDragOverId((current) => (current === img.id ? null : current))}
                onDrop={async () => {
                  if (!draggedId || draggedId === img.id) return;
                  const from = imageIds.indexOf(draggedId);
                  const to = imageIds.indexOf(img.id);
                  if (from < 0 || to < 0) return;
                  const next = images.slice();
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved);
                  await persistOrder(next);
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDragOverId(null);
                }}
              >
                <div className="relative">
                  <Image
                    src={fileHref(img.thumbPath || img.path)}
                    alt={img.caption || `Bild ${index + 1}`}
                    width={96}
                    height={80}
                    unoptimized
                    className="h-20 w-full rounded object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-white/90 p-1 text-red-700 hover:bg-white"
                    aria-label="Bild löschen"
                    title="Bild löschen"
                    onClick={async () => {
                      await fetch(`/api/items/${params.id}/images?imageId=${img.id}`, { method: "DELETE" });
                      await load();
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="mt-1 text-center text-xs">{index === 0 ? "Titelbild" : `Bild ${index + 1}`}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
