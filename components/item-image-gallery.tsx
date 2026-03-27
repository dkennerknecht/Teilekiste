"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { fileHref } from "@/lib/file-href";

type ItemImage = {
  id: string;
  path: string;
  thumbPath: string | null;
  caption: string | null;
  sortOrder: number;
};

export function ItemImageGallery(props: {
  itemId: string;
  itemName: string;
  images: ItemImage[];
  editMode: boolean;
  onReload: () => Promise<void>;
}) {
  const [previewImage, setPreviewImage] = useState<ItemImage | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [images, setImages] = useState<ItemImage[]>(props.images);

  useEffect(() => {
    setImages(props.images);
  }, [props.images]);

  const primaryImage = useMemo(() => (images.length ? images[0] : null), [images]);

  async function persistImageOrder(nextImages: ItemImage[]) {
    setImages(nextImages);
    await fetch(`/api/items/${props.itemId}/images`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderedImageIds: nextImages.map((img) => img.id) })
    });
    await props.onReload();
  }

  return (
    <>
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative h-[80vh] w-[92vw] sm:h-[90vh] sm:w-[90vw]">
            <Image
              src={fileHref(previewImage.path)}
              alt={previewImage.caption || props.itemName}
              fill
              unoptimized
              className="rounded-xl object-contain"
              sizes="90vw"
            />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-workshop-200 bg-[var(--app-surface)]">
        {primaryImage ? (
          <button type="button" className="relative block h-[280px] w-full cursor-zoom-in sm:h-[360px] lg:h-[460px]" onClick={() => setPreviewImage(primaryImage)}>
            <Image
              src={fileHref(primaryImage.path)}
              alt={primaryImage.caption || props.itemName}
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
          </button>
        ) : (
          <div className="theme-muted flex h-[460px] items-center justify-center">Kein Bild vorhanden</div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {images.map((img, index) => (
          <div
            key={img.id}
            className="relative"
            draggable={props.editMode}
            onDragStart={() => setDraggedId(img.id)}
            onDragOver={(e) => props.editMode && e.preventDefault()}
            onDrop={async () => {
              if (!props.editMode || !draggedId || draggedId === img.id) return;
              const from = images.findIndex((entry) => entry.id === draggedId);
              const to = images.findIndex((entry) => entry.id === img.id);
              if (from < 0 || to < 0) return;
              const next = images.slice();
              const [moved] = next.splice(from, 1);
              next.splice(to, 0, moved);
              await persistImageOrder(next);
              setDraggedId(null);
            }}
            onDragEnd={() => setDraggedId(null)}
          >
            <button
              type="button"
              className={`relative block h-[72px] w-[72px] cursor-zoom-in overflow-hidden rounded-xl border sm:h-[88px] sm:w-[88px] ${index === 0 ? "border-[var(--app-primary)]" : "border-workshop-200"}`}
              onClick={() => setPreviewImage(img)}
            >
              <Image
                src={fileHref(img.thumbPath || img.path)}
                alt={img.caption || `Bild ${index + 1}`}
                fill
                unoptimized
                className="object-cover"
                sizes="88px"
              />
            </button>
            {props.editMode && (
              <button
                type="button"
                className="absolute right-1 top-1 rounded bg-white/90 p-1 text-red-700"
                onClick={async () => {
                  await fetch(`/api/items/${props.itemId}/images?imageId=${img.id}`, { method: "DELETE" });
                  await props.onReload();
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {props.editMode && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await fetch(`/api/items/${props.itemId}/images`, { method: "POST", body: fd });
            e.currentTarget.reset();
            await props.onReload();
          }}
        >
          <input className="input" type="file" name="file" accept="image/*" capture="environment" required />
          <input className="input sm:flex-1" type="text" name="caption" placeholder="Bildtitel" />
          <button className="btn-secondary w-full sm:w-auto" type="submit">Upload</button>
        </form>
      )}
    </>
  );
}
