"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAppLanguage } from "@/components/app-language-provider";
import { StorageLocationSelectField, StorageShelfSelectField } from "@/components/storage-select-fields";
import { translateApiErrorMessage } from "@/lib/app-language";
import {
  getShelvesForLocation,
  getStorageBinDisplayLabel,
  getStorageShelfDisplayLabel,
  type StorageBinOption,
  type StorageLocationOption,
  type StorageShelfOption
} from "@/lib/storage-ui";

export default function AdminBinsPage() {
  const { language } = useAppLanguage();
  const tr = useCallback((de: string, en: string) => (language === "en" ? en : de), [language]);
  const [locations, setLocations] = useState<StorageLocationOption[]>([]);
  const [shelves, setShelves] = useState<StorageShelfOption[]>([]);
  const [bins, setBins] = useState<StorageBinOption[]>([]);
  const [feedback, setFeedback] = useState("");
  const [newBin, setNewBin] = useState({ code: "", storageLocationId: "", storageShelfId: "", slotCount: 3 });
  const [rangeForm, setRangeForm] = useState({ start: 1, end: 30, storageLocationId: "", storageShelfId: "", slotCount: 3 });
  const [swapForm, setSwapForm] = useState({ leftBinId: "", rightBinId: "" });
  const [moveForm, setMoveForm] = useState({ sourceBinId: "", targetBinId: "" });
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [slotDrafts, setSlotDrafts] = useState<Record<string, string>>({});
  const [slotPreview, setSlotPreview] = useState<Record<string, string>>({});
  const [binFilters, setBinFilters] = useState({
    query: "",
    storageLocationId: "",
    storageShelfId: "",
    status: "all"
  });

  const load = useCallback(async () => {
    const [locationsData, shelvesData, binsData] = await Promise.all([
      fetch("/api/admin/locations", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/admin/shelves", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/admin/bins", { cache: "no-store" }).then((res) => res.json())
    ]);
    setLocations(locationsData || []);
    setShelves(shelvesData || []);
    setBins(binsData || []);
    if (locationsData?.[0]) {
      setNewBin((prev) => ({ ...prev, storageLocationId: prev.storageLocationId || locationsData[0].id }));
      setRangeForm((prev) => ({ ...prev, storageLocationId: prev.storageLocationId || locationsData[0].id }));
    }
    setSlotDrafts(
      Object.fromEntries((binsData || []).map((bin: StorageBinOption) => [bin.id, String(bin.slotCount)]))
    );
    setCodeDrafts(
      Object.fromEntries((binsData || []).map((bin: StorageBinOption) => [bin.id, String(bin.code || "")]))
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const availableNewShelves = useMemo(
    () => getShelvesForLocation(shelves, newBin.storageLocationId, { mode: "DRAWER_HOST" }),
    [newBin.storageLocationId, shelves]
  );
  const availableRangeShelves = useMemo(
    () => getShelvesForLocation(shelves, rangeForm.storageLocationId, { mode: "DRAWER_HOST" }),
    [rangeForm.storageLocationId, shelves]
  );
  const availableFilterShelves = useMemo(
    () =>
      binFilters.storageLocationId
        ? getShelvesForLocation(shelves, binFilters.storageLocationId, { mode: "DRAWER_HOST" })
        : shelves.filter((entry) => entry.mode === "DRAWER_HOST"),
    [binFilters.storageLocationId, shelves]
  );
  const filteredBins = useMemo(() => {
    const query = binFilters.query.trim().toLowerCase();

    return bins.filter((bin) => {
      if (binFilters.storageLocationId && bin.storageLocationId !== binFilters.storageLocationId) {
        return false;
      }
      if (binFilters.storageShelfId && bin.storageShelfId !== binFilters.storageShelfId) {
        return false;
      }
      if (binFilters.status === "active" && !bin.isActive) {
        return false;
      }
      if (binFilters.status === "inactive" && bin.isActive) {
        return false;
      }
      if (!query) {
        return true;
      }

      const haystack = [
        bin.code,
        bin.fullCode || "",
        bin.storageLocation?.name || "",
        bin.storageLocation?.code || "",
        bin.storageShelf?.code || "",
        bin.storageShelf?.name || "",
        bin.storageArea || ""
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [binFilters, bins]);

  async function postJson(url: string, payload: unknown, method = "POST") {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(translateApiErrorMessage(language, data?.error) || tr("Anfrage fehlgeschlagen", "Request failed"));
    }
    return data;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{tr("Drawer-Verwaltung", "Drawer management")}</h1>
          <p className="text-sm text-workshop-700">
            {tr("Managed Drawer fuer QR-Codes, Unterfaecher und feste Magazinpositionen.", "Managed drawers for QR codes, sub-slots, and fixed magazine positions.")}
          </p>
        </div>
        <Link className="btn-secondary" href="/admin">
          {tr("Zurueck zu Admin", "Back to Admin")}
        </Link>
      </div>

      {feedback && <div className="card text-sm text-workshop-700">{feedback}</div>}

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{tr("Einzelnen Drawer anlegen", "Create single drawer")}</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span>{tr("Drawer-Nummer", "Drawer number")}</span>
            <input
              className="input"
              inputMode="numeric"
              maxLength={2}
              placeholder="01"
              value={newBin.code}
              onChange={(e) => setNewBin((prev) => ({ ...prev, code: e.target.value }))}
            />
          </label>
          <StorageLocationSelectField
            label={tr("Lagerort", "Storage location")}
            wrapperClassName="space-y-1 text-sm"
            labelClassName=""
            selectClassName="input"
            value={newBin.storageLocationId}
            options={locations}
            onChange={(value) => setNewBin((prev) => ({ ...prev, storageLocationId: value, storageShelfId: "" }))}
            emptyLabel={tr("Lagerort waehlen", "Choose storage location")}
          />
          <StorageShelfSelectField
            label={tr("Regal", "Shelf")}
            wrapperClassName="space-y-1 text-sm"
            labelClassName=""
            selectClassName="input"
            value={newBin.storageShelfId}
            shelves={availableNewShelves}
            onChange={(value) => setNewBin((prev) => ({ ...prev, storageShelfId: value }))}
            emptyLabel={tr("Regal waehlen", "Choose shelf")}
          />
          <label className="space-y-1 text-sm">
            <span>{tr("Unterfaecher", "Slots")}</span>
            <input className="input" type="number" min={1} max={99} value={newBin.slotCount} onChange={(e) => setNewBin((prev) => ({ ...prev, slotCount: Number(e.target.value) }))} />
          </label>
        </div>
        {newBin.storageLocationId && availableNewShelves.length === 0 && (
          <p className="text-sm text-workshop-700">
            {tr(
              'Kein Drawer-Host-Regal an diesem Lagerort vorhanden. Lege unter Admin ein Regal mit Modus "Drawer-Host" an.',
              'No drawer-host shelf exists for this storage location yet. Create a shelf with mode "Drawer host" in Admin.'
            )}
          </p>
        )}
        <button
          className="btn"
          onClick={async () => {
            try {
              await postJson("/api/admin/bins", newBin);
              setFeedback(tr("Drawer angelegt.", "Drawer created."));
              setNewBin((prev) => ({ ...prev, code: "" }));
              await load();
            } catch (error) {
              setFeedback((error as Error).message);
            }
          }}
        >
          {tr("Drawer anlegen", "Create drawer")}
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{tr("Bereich erzeugen / erweitern", "Generate / extend range")}</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <label className="space-y-1 text-sm">
            <span>{tr("Von", "From")}</span>
            <input className="input" type="number" min={1} max={99} value={rangeForm.start} onChange={(e) => setRangeForm((prev) => ({ ...prev, start: Number(e.target.value) }))} />
          </label>
          <label className="space-y-1 text-sm">
            <span>{tr("Bis", "To")}</span>
            <input className="input" type="number" min={1} max={99} value={rangeForm.end} onChange={(e) => setRangeForm((prev) => ({ ...prev, end: Number(e.target.value) }))} />
          </label>
          <StorageLocationSelectField
            label={tr("Lagerort", "Storage location")}
            wrapperClassName="space-y-1 text-sm"
            labelClassName=""
            selectClassName="input"
            value={rangeForm.storageLocationId}
            options={locations}
            onChange={(value) => setRangeForm((prev) => ({ ...prev, storageLocationId: value, storageShelfId: "" }))}
            emptyLabel={tr("Lagerort waehlen", "Choose storage location")}
          />
          <StorageShelfSelectField
            label={tr("Regal", "Shelf")}
            wrapperClassName="space-y-1 text-sm"
            labelClassName=""
            selectClassName="input"
            value={rangeForm.storageShelfId}
            shelves={availableRangeShelves}
            onChange={(value) => setRangeForm((prev) => ({ ...prev, storageShelfId: value }))}
            emptyLabel={tr("Regal waehlen", "Choose shelf")}
          />
          <label className="space-y-1 text-sm">
            <span>{tr("Unterfaecher", "Slots")}</span>
            <input className="input" type="number" min={1} max={99} value={rangeForm.slotCount} onChange={(e) => setRangeForm((prev) => ({ ...prev, slotCount: Number(e.target.value) }))} />
          </label>
        </div>
        {rangeForm.storageLocationId && availableRangeShelves.length === 0 && (
          <p className="text-sm text-workshop-700">
            {tr(
              'Kein Drawer-Host-Regal an diesem Lagerort vorhanden. Lege unter Admin ein Regal mit Modus "Drawer-Host" an.',
              'No drawer-host shelf exists for this storage location yet. Create a shelf with mode "Drawer host" in Admin.'
            )}
          </p>
        )}
        <button
          className="btn-secondary"
          onClick={async () => {
            try {
              const result = await postJson("/api/admin/bins/range", rangeForm);
              setFeedback(
                language === "en"
                  ? `Range processed: ${result.createdCount} created, ${result.existingCount} already existed.`
                  : `Bereich verarbeitet: ${result.createdCount} angelegt, ${result.existingCount} bereits vorhanden.`
              );
              await load();
            } catch (error) {
              setFeedback((error as Error).message);
            }
          }}
        >
          {tr("Bereich anlegen", "Create range")}
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{tr("Drawer verschieben", "Move drawers")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>{tr("Quell-Drawer", "Source drawer")}</span>
            <select className="input" value={moveForm.sourceBinId} onChange={(e) => setMoveForm((prev) => ({ ...prev, sourceBinId: e.target.value }))}>
              <option value="">{tr("Quell-Drawer waehlen", "Choose source drawer")}</option>
              {bins.map((bin) => (
                <option key={bin.id} value={bin.id}>
                  {`${getStorageBinDisplayLabel(bin, shelves)} · ${bin.storageLocation?.name || "-"}`}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>{tr("Ziel-Drawer", "Target drawer")}</span>
            <select className="input" value={moveForm.targetBinId} onChange={(e) => setMoveForm((prev) => ({ ...prev, targetBinId: e.target.value }))}>
              <option value="">{tr("Ziel-Drawer waehlen", "Choose target drawer")}</option>
              {bins.map((bin) => (
                <option key={bin.id} value={bin.id}>
                  {`${getStorageBinDisplayLabel(bin, shelves)} · ${bin.storageLocation?.name || "-"}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="btn-secondary"
          onClick={async () => {
            try {
              await postJson("/api/admin/bins/move", moveForm);
              setFeedback(tr("Drawer-Inhalte verschoben.", "Drawer contents moved."));
              setMoveForm({ sourceBinId: "", targetBinId: "" });
              await load();
            } catch (error) {
              setFeedback((error as Error).message);
            }
          }}
          disabled={!moveForm.sourceBinId || !moveForm.targetBinId}
        >
          {tr("Move ausfuehren", "Run move")}
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{tr("Drawer tauschen", "Swap drawers")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>{tr("Linker Drawer", "Left drawer")}</span>
            <select className="input" value={swapForm.leftBinId} onChange={(e) => setSwapForm((prev) => ({ ...prev, leftBinId: e.target.value }))}>
              <option value="">{tr("Linken Drawer waehlen", "Choose left drawer")}</option>
              {bins.map((bin) => (
                <option key={bin.id} value={bin.id}>
                  {`${getStorageBinDisplayLabel(bin, shelves)} · ${bin.storageLocation?.name || "-"}`}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>{tr("Rechter Drawer", "Right drawer")}</span>
            <select className="input" value={swapForm.rightBinId} onChange={(e) => setSwapForm((prev) => ({ ...prev, rightBinId: e.target.value }))}>
              <option value="">{tr("Rechten Drawer waehlen", "Choose right drawer")}</option>
              {bins.map((bin) => (
                <option key={bin.id} value={bin.id}>
                  {`${getStorageBinDisplayLabel(bin, shelves)} · ${bin.storageLocation?.name || "-"}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="btn-secondary"
          onClick={async () => {
            try {
              await postJson("/api/admin/bins/swap", swapForm);
              setFeedback(tr("Drawer-Inhalte getauscht.", "Drawer contents swapped."));
              setSwapForm({ leftBinId: "", rightBinId: "" });
              await load();
            } catch (error) {
              setFeedback((error as Error).message);
            }
          }}
          disabled={!swapForm.leftBinId || !swapForm.rightBinId}
        >
          {tr("Tausch ausfuehren", "Run swap")}
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{tr("Vorhandene Drawer", "Existing drawers")}</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span>{tr("Filter", "Filter")}</span>
            <input
              className="input"
              placeholder={tr("Code, Ort oder Regal filtern", "Filter by code, location, or shelf")}
              value={binFilters.query}
              onChange={(e) => setBinFilters((prev) => ({ ...prev, query: e.target.value }))}
            />
          </label>
          <StorageLocationSelectField
            label={tr("Lagerort", "Storage location")}
            wrapperClassName="space-y-1 text-sm"
            labelClassName=""
            selectClassName="input"
            value={binFilters.storageLocationId}
            options={locations}
            onChange={(value) => setBinFilters((prev) => ({ ...prev, storageLocationId: value, storageShelfId: "" }))}
            emptyLabel={tr("Alle Orte", "All locations")}
          />
          <StorageShelfSelectField
            label={tr("Regal", "Shelf")}
            wrapperClassName="space-y-1 text-sm"
            labelClassName=""
            selectClassName="input"
            value={binFilters.storageShelfId}
            shelves={availableFilterShelves}
            onChange={(value) => setBinFilters((prev) => ({ ...prev, storageShelfId: value }))}
            emptyLabel={tr("Alle Regale", "All shelves")}
          />
          <label className="space-y-1 text-sm">
            <span>{tr("Status", "Status")}</span>
            <select
              className="input"
              value={binFilters.status}
              onChange={(e) => setBinFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">{tr("Alle Stati", "All statuses")}</option>
              <option value="active">{tr("Nur aktiv", "Active only")}</option>
              <option value="inactive">{tr("Nur inaktiv", "Inactive only")}</option>
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between text-sm text-workshop-700">
          <p>
            {language === "en"
              ? `${filteredBins.length} of ${bins.length} drawers shown`
              : `${filteredBins.length} von ${bins.length} Drawern angezeigt`}
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setBinFilters({ query: "", storageLocationId: "", storageShelfId: "", status: "all" })}
          >
            {tr("Filter zuruecksetzen", "Reset filters")}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b border-workshop-200 text-left">
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">{tr("Ort", "Location")}</th>
                <th className="px-2 py-2">{tr("Regal", "Shelf")}</th>
                <th className="px-2 py-2">{tr("Slots", "Slots")}</th>
                <th className="px-2 py-2">{tr("Belegt", "Occupied")}</th>
                <th className="px-2 py-2">{tr("Status", "Status")}</th>
                <th className="px-2 py-2">{tr("Aktionen", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredBins.map((bin) => (
                <tr key={bin.id} className="border-b border-workshop-100">
                  <td className="px-2 py-2 font-mono">
                    <div className="space-y-2">
                      <Link
                        className="hover:underline"
                        href={`/bins/${encodeURIComponent(getStorageBinDisplayLabel(bin, shelves) || bin.code)}`}
                      >
                        {getStorageBinDisplayLabel(bin, shelves)}
                      </Link>
                      <input
                        className="input h-10 w-20 font-mono"
                        inputMode="numeric"
                        maxLength={2}
                        value={codeDrafts[bin.id] ?? String(bin.code)}
                        onChange={(e) => setCodeDrafts((prev) => ({ ...prev, [bin.id]: e.target.value }))}
                        placeholder="01"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">{bin.storageLocation?.name || "-"}</td>
                  <td className="px-2 py-2">
                    {[getStorageShelfDisplayLabel(bin.storageShelf), bin.storageShelf?.name || bin.storageArea].filter(Boolean).join(" - ") || "-"}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        className="input h-10 w-20"
                        type="number"
                        min={1}
                        max={99}
                        value={slotDrafts[bin.id] ?? String(bin.slotCount)}
                        onChange={(e) => setSlotDrafts((prev) => ({ ...prev, [bin.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={async () => {
                          try {
                            const preview = await postJson("/api/admin/bins/slot-count-preview", {
                              id: bin.id,
                              slotCount: Number(slotDrafts[bin.id] || bin.slotCount)
                            });
                            setSlotPreview((prev) => ({
                              ...prev,
                              [bin.id]:
                                preview.displacedItems.length > 0
                                  ? language === "en"
                                    ? `${preview.displacedItems.length} item(s) will become unplaced.`
                                    : `${preview.displacedItems.length} Item(s) werden unplatziert.`
                                  : tr("Keine Items betroffen.", "No items affected.")
                            }));
                          } catch (error) {
                            setSlotPreview((prev) => ({ ...prev, [bin.id]: (error as Error).message }));
                          }
                        }}
                      >
                        {tr("Preview", "Preview")}
                      </button>
                    </div>
                    {slotPreview[bin.id] && <p className="mt-1 text-xs text-workshop-700">{slotPreview[bin.id]}</p>}
                  </td>
                  <td className="px-2 py-2">{bin._count?.items ?? 0}</td>
                  <td className="px-2 py-2">{bin.isActive ? tr("Aktiv", "Active") : tr("Inaktiv", "Inactive")}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={async () => {
                          try {
                            await postJson("/api/admin/bins", {
                              id: bin.id,
                              code: codeDrafts[bin.id] || bin.code,
                              slotCount: Number(slotDrafts[bin.id] || bin.slotCount),
                              isActive: bin.isActive
                            }, "PATCH");
                            setFeedback(tr("Drawer aktualisiert.", "Drawer updated."));
                            await load();
                          } catch (error) {
                            setFeedback((error as Error).message);
                          }
                        }}
                      >
                        {tr("Speichern", "Save")}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={async () => {
                          try {
                            await postJson("/api/admin/bins", { id: bin.id }, "DELETE");
                            setFeedback(tr("Drawer geloescht.", "Drawer deleted."));
                            await load();
                          } catch (error) {
                            setFeedback((error as Error).message);
                          }
                        }}
                      >
                        {tr("Loeschen", "Delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBins.length === 0 && (
                <tr>
                  <td className="px-2 py-6 text-center text-workshop-700" colSpan={7}>
                    {tr("Keine Drawer fuer den aktuellen Filter gefunden.", "No drawers found for the current filter.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
