"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  const [activeImageId, setActiveImageId] = useState<string | null>(props.images[0]?.id || null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    setImages(props.images);
  }, [props.images]);

  useEffect(() => {
    if (!images.length) {
      setActiveImageId(null);
      return;
    }

    setActiveImageId((current) => (current && images.some((image) => image.id === current) ? current : images[0].id));
  }, [images]);

  const activeImage = useMemo(() => {
    if (!images.length) return null;
    return images.find((image) => image.id === activeImageId) || images[0];
  }, [activeImageId, images]);
  const hasImages = images.length > 0;

  async function persistImageOrder(nextImages: ItemImage[]) {
    setImages(nextImages);
    await fetch(`/api/items/${props.itemId}/images`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderedImageIds: nextImages.map((img) => img.id) })
    });
    await props.onReload();
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!files.length) {
      setUploadError("Bitte mindestens ein Bild auswaehlen.");
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const response = await fetch(`/api/items/${props.itemId}/images`, {
        method: "POST",
        body: formData
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setUploadError(payload?.error || "Upload fehlgeschlagen.");
        return;
      }

      const createdImages = Array.isArray(payload) ? payload : [];
      if (createdImages.length > 0) {
        setImages((current) => {
          const next = [...current];
          const existingIds = new Set(current.map((image) => image.id));
          for (const image of createdImages) {
            if (!existingIds.has(image.id)) {
              next.push(image);
            }
          }
          return next.sort((left, right) => left.sortOrder - right.sortOrder);
        });
        if (!activeImageId && createdImages[0]) {
          setActiveImageId(createdImages[0].id);
        }
      }

      form.reset();
      await props.onReload();
    } catch {
      setUploadError("Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
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
        {activeImage ? (
          <button type="button" className="relative block h-[280px] w-full cursor-zoom-in sm:h-[360px] lg:h-[460px]" onClick={() => setPreviewImage(activeImage)}>
            <Image
              src={fileHref(activeImage.path)}
              alt={activeImage.caption || props.itemName}
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
          </button>
        ) : props.editMode ? (
          <div className="theme-muted flex min-h-[7rem] items-center justify-center px-4 py-6 text-center text-sm">
            Noch kein Bild hochgeladen.
          </div>
        ) : null}
      </div>

      {hasImages && (
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
                className={`relative block h-[72px] w-[72px] overflow-hidden rounded-xl border sm:h-[88px] sm:w-[88px] ${img.id === activeImage?.id ? "border-[var(--app-primary)]" : "border-workshop-200"}`}
                onClick={() => setActiveImageId(img.id)}
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
      )}

      {props.editMode && (
        <div className="mt-3 space-y-2">
          <form className="flex flex-col gap-2 sm:flex-row sm:flex-wrap" onSubmit={handleUpload}>
            <input className="input" type="file" name="files" accept="image/*" capture="environment" multiple required />
            <input className="input sm:flex-1" type="text" name="caption" placeholder="Bildtitel (optional bei Einzelupload)" />
            <button className="btn-secondary w-full sm:w-auto" type="submit" disabled={uploading}>
              {uploading ? "Laedt..." : "Bilder hochladen"}
            </button>
          </form>
          <p className="theme-muted text-xs">Mehrfachauswahl ist moeglich. Ein gemeinsamer Bildtitel wird nur bei Einzelupload gesetzt.</p>
          {uploadError && <p className="text-sm text-red-700">{uploadError}</p>}
        </div>
      )}
    </>
  );
}
