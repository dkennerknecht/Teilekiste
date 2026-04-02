import { formatStorageBinLabel, formatStorageShelfLabel } from "@/lib/storage-labels";

export type StorageLocationOption = {
  id: string;
  name: string;
  code?: string | null;
};

export type StorageShelfOption = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  mode?: string | null;
  storageLocationId: string;
  storageLocation?: StorageLocationOption | null;
};

export type StorageBinOption = {
  id: string;
  code: string;
  fullCode?: string | null;
  storageLocationId: string;
  storageShelfId: string;
  storageArea?: string | null;
  slotCount: number;
  isActive?: boolean;
  storageLocation?: StorageLocationOption | null;
  storageShelf?: StorageShelfOption | null;
  _count?: { items?: number };
};

export function getShelvesForLocation<T extends { storageLocationId: string; mode?: string | null }>(
  shelves: T[],
  storageLocationId: string,
  input?: { mode?: string | null }
) {
  return shelves.filter((shelf) => {
    if (shelf.storageLocationId !== storageLocationId) {
      return false;
    }
    if (input?.mode && shelf.mode !== input.mode) {
      return false;
    }
    return true;
  });
}

export function getBinsForShelf<T extends { storageShelfId: string }>(bins: T[], storageShelfId: string) {
  return bins.filter((bin) => bin.storageShelfId === storageShelfId);
}

export function getStorageShelfDisplayLabel(shelf?: Pick<StorageShelfOption, "code" | "name"> | null) {
  return formatStorageShelfLabel(shelf?.code || null, shelf?.name || null) || shelf?.name || "-";
}

export function getStorageShelfOptionLabel(shelf?: Pick<StorageShelfOption, "code" | "name"> | null) {
  const label = getStorageShelfDisplayLabel(shelf);
  if (!shelf?.name || shelf.name === label) {
    return label;
  }
  return `${label} - ${shelf.name}`;
}

export function getStorageBinDisplayLabel(
  bin?: Pick<StorageBinOption, "code" | "fullCode" | "storageShelfId" | "storageShelf"> | null,
  shelves: Array<Pick<StorageShelfOption, "id" | "code">> = []
) {
  if (!bin) return "";
  const shelfCode = bin.storageShelf?.code || shelves.find((entry) => entry.id === bin.storageShelfId)?.code || null;
  return (
    bin.fullCode ||
    formatStorageBinLabel({
      shelfCode,
      binCode: bin.code
    }) ||
    bin.code
  );
}

export function storageBinRequiresSlot(bin?: Pick<StorageBinOption, "slotCount"> | null) {
  return !!bin && bin.slotCount > 1;
}

export function getStorageBinSlots(bin?: Pick<StorageBinOption, "slotCount"> | null) {
  if (!bin || bin.slotCount <= 1) return [];
  return Array.from({ length: bin.slotCount }, (_, index) => index + 1);
}
