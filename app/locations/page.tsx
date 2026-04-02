"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppLanguage } from "@/components/app-language-provider";
import { translateApiErrorMessage } from "@/lib/app-language";
import { formatDisplayQuantity } from "@/lib/quantity";

export default function LocationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useAppLanguage();
  const tr = useCallback((de: string, en: string) => (language === "en" ? en : de), [language]);
  const [overview, setOverview] = useState<{
    availableLocations: Array<{ id: string; name: string; code?: string | null }>;
    summary: { locationCount: number; shelfCount: number; drawerCount: number; itemCount: number };
    locations: Array<any>;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const queryString = searchParams.toString();
  const [filters, setFilters] = useState({
    storageLocationId: "",
    shelfQuery: "",
    drawerQuery: "",
    showEmptyShelves: true,
    showEmptyDrawers: true,
    mode: "all"
  });

  useEffect(() => {
    setFilters({
      storageLocationId: searchParams.get("storageLocationId") || "",
      shelfQuery: searchParams.get("shelfQuery") || "",
      drawerQuery: searchParams.get("drawerQuery") || "",
      showEmptyShelves: searchParams.get("showEmptyShelves") !== "0",
      showEmptyDrawers: searchParams.get("showEmptyDrawers") !== "0",
      mode: searchParams.get("mode") || "all"
    });
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      setLoading(true);
      try {
        const response = await fetch(`/api/storage-overview${queryString ? `?${queryString}` : ""}`, {
          cache: "no-store"
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            translateApiErrorMessage(language, data?.error) ||
              tr("Lagerplatzuebersicht konnte nicht geladen werden", "Failed to load storage overview")
          );
        }
        if (!cancelled) {
          setOverview(data);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((loadError as Error).message);
          setOverview(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [language, queryString, tr]);

  const visibleCounts = useMemo(() => {
    if (!overview) {
      return { locationCount: 0, shelfCount: 0, drawerCount: 0, itemCount: 0 };
    }
    return overview.summary;
  }, [overview]);

  function applyFilters(event?: React.FormEvent) {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (filters.storageLocationId) params.set("storageLocationId", filters.storageLocationId);
    if (filters.shelfQuery.trim()) params.set("shelfQuery", filters.shelfQuery.trim());
    if (filters.drawerQuery.trim()) params.set("drawerQuery", filters.drawerQuery.trim());
    if (!filters.showEmptyShelves) params.set("showEmptyShelves", "0");
    if (!filters.showEmptyDrawers) params.set("showEmptyDrawers", "0");
    if (filters.mode !== "all") params.set("mode", filters.mode);
    router.replace(params.toString() ? `/locations?${params.toString()}` : "/locations", { scroll: false });
  }

  function resetFilters() {
    setFilters({
      storageLocationId: "",
      shelfQuery: "",
      drawerQuery: "",
      showEmptyShelves: true,
      showEmptyDrawers: true,
      mode: "all"
    });
    router.replace("/locations", { scroll: false });
  }

  if (error) {
    return <div className="card text-sm text-red-700">{error}</div>;
  }

  if (loading && !overview) {
    return <p>{tr("Lade...", "Loading...")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{tr("Lagerplatzuebersicht", "Storage overview")}</h1>
          <p className="text-sm text-workshop-700">
            {language === "en"
              ? `${visibleCounts.locationCount} locations · ${visibleCounts.shelfCount} shelves · ${visibleCounts.drawerCount} drawers · ${visibleCounts.itemCount} items visible`
              : `${visibleCounts.locationCount} Lagerorte · ${visibleCounts.shelfCount} Regale · ${visibleCounts.drawerCount} Drawer · ${visibleCounts.itemCount} Items sichtbar`}
          </p>
        </div>
      </div>

      <form className="card space-y-3" onSubmit={applyFilters}>
        <div className="grid gap-3 md:grid-cols-5">
          <label className="space-y-1 text-sm">
            <span>{tr("Lagerort", "Storage location")}</span>
            <select
              className="input"
              value={filters.storageLocationId}
              onChange={(event) => setFilters((prev) => ({ ...prev, storageLocationId: event.target.value }))}
            >
              <option value="">{tr("Alle Orte", "All locations")}</option>
              {overview?.availableLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span>{tr("Shelf-Filter", "Shelf filter")}</span>
            <input
              className="input"
              placeholder={tr("z. B. AB oder Sicherungen", "e.g. AB or fuses")}
              value={filters.shelfQuery}
              onChange={(event) => setFilters((prev) => ({ ...prev, shelfQuery: event.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span>{tr("Drawer-Filter", "Drawer filter")}</span>
            <input
              className="input"
              placeholder={tr("z. B. AB04", "e.g. AB04")}
              value={filters.drawerQuery}
              onChange={(event) => setFilters((prev) => ({ ...prev, drawerQuery: event.target.value }))}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span>{tr("Modus", "Mode")}</span>
            <select
              className="input"
              value={filters.mode}
              onChange={(event) => setFilters((prev) => ({ ...prev, mode: event.target.value }))}
            >
              <option value="all">{tr("Alle", "All")}</option>
              <option value="open">{tr("Nur offene Bereiche", "Open areas only")}</option>
              <option value="drawer">{tr("Nur Drawer-Regale", "Drawer shelves only")}</option>
            </select>
          </label>

          <div className="flex flex-col gap-2 pt-6 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.showEmptyShelves}
                onChange={(event) => setFilters((prev) => ({ ...prev, showEmptyShelves: event.target.checked }))}
              />
              <span>{tr("Leere Shelfs zeigen", "Show empty shelves")}</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.showEmptyDrawers}
                onChange={(event) => setFilters((prev) => ({ ...prev, showEmptyDrawers: event.target.checked }))}
              />
              <span>{tr("Leere Drawer zeigen", "Show empty drawers")}</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="submit">
            {tr("Filter anwenden", "Apply filters")}
          </button>
          <button className="btn-secondary" type="button" onClick={resetFilters}>
            {tr("Filter zuruecksetzen", "Reset filters")}
          </button>
        </div>
      </form>

      {!overview || overview.locations.length === 0 ? (
        <div className="card text-sm text-workshop-700">
          {tr("Keine Lagerplaetze fuer den aktuellen Filter gefunden.", "No storage places found for the current filter.")}
        </div>
      ) : (
        <div className="space-y-6">
          {overview.locations.map((location) => (
            <section key={location.id} className="space-y-3">
              <div className="card">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{location.name}</h2>
                    <p className="text-sm text-workshop-700">{location.code || "-"}</p>
                  </div>
                  <p className="text-sm text-workshop-700">
                    {language === "en"
                      ? `${location.summary.shelfCount} shelves · ${location.summary.drawerCount} drawers · ${location.summary.itemCount} items`
                      : `${location.summary.shelfCount} Regale · ${location.summary.drawerCount} Drawer · ${location.summary.itemCount} Items`}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {location.shelves.map((shelf: any) => (
                  <article key={shelf.id} className="card space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link className="font-mono text-sm text-workshop-700 hover:underline" href={`/shelves/${encodeURIComponent(shelf.id)}`}>
                          {shelf.displayCode || shelf.code || shelf.name}
                        </Link>
                        <h3 className="text-lg font-semibold">{shelf.name}</h3>
                        {shelf.description ? <p className="text-sm text-workshop-700">{shelf.description}</p> : null}
                      </div>
                      <span className="rounded-full border border-workshop-200 px-3 py-1 text-xs text-workshop-700">
                        {shelf.mode === "OPEN_AREA" ? tr("Offener Bereich", "Open area") : tr("Drawer-Regal", "Drawer shelf")}
                      </span>
                    </div>

                    <p className="text-sm text-workshop-700">
                      {language === "en"
                        ? `${shelf.summary.itemCount} items · ${shelf.summary.drawerCount} drawers`
                        : `${shelf.summary.itemCount} Items · ${shelf.summary.drawerCount} Drawer`}
                    </p>

                    {shelf.mode === "OPEN_AREA" ? (
                      shelf.items.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-workshop-200 p-3 text-sm text-workshop-700">
                          {tr("Keine Items direkt auf diesem Shelf.", "No items directly on this shelf.")}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {shelf.items.map((item: any) => (
                            <div key={item.id} className="rounded-xl border border-workshop-200 p-3">
                              <Link className="font-medium hover:underline" href={`/items/${item.id}`}>
                                {item.name}
                              </Link>
                              <p className="text-sm text-workshop-700">{item.labelCode}</p>
                              <p className="text-sm text-workshop-700">{item.displayPosition || "-"}</p>
                              <p className="text-sm">
                                {tr("Bestand", "Stock")}: {formatDisplayQuantity(item.unit, item.stock)} · {tr("Verfuegbar", "Available")}:{" "}
                                {formatDisplayQuantity(item.unit, item.availableStock)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )
                    ) : shelf.bins.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-workshop-200 p-3 text-sm text-workshop-700">
                        {tr("Keine Drawer fuer dieses Shelf sichtbar.", "No drawers visible for this shelf.")}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {shelf.bins.map((bin: any) => (
                          <div key={bin.id} className="rounded-xl border border-workshop-200 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <Link
                                  className="font-mono text-sm text-workshop-700 hover:underline"
                                  href={`/bins/${encodeURIComponent(bin.fullCode || bin.code)}`}
                                >
                                  {bin.fullCode || bin.code}
                                </Link>
                                <p className="text-sm text-workshop-700">
                                  {tr("Slots", "Slots")}: {bin.slotCount} · {tr("Belegt", "Occupied")}: {bin.summary.occupiedCount} · {tr("Frei", "Free")}: {bin.summary.freeSlotCount}
                                </p>
                              </div>
                            </div>

                            {bin.items.length === 0 ? (
                              <p className="mt-2 text-sm text-workshop-700">{tr("Leer", "Empty")}</p>
                            ) : (
                              <div className="mt-2 space-y-2">
                                {bin.items.map((item: any) => (
                                  <div key={item.id} className="rounded-lg border border-workshop-100 p-2">
                                    <Link className="font-medium hover:underline" href={`/items/${item.id}`}>
                                      {item.name}
                                    </Link>
                                    <p className="text-sm text-workshop-700">
                                      {item.labelCode}
                                      {item.binSlot ? ` · ${bin.fullCode || bin.code}-${item.binSlot}` : ""}
                                    </p>
                                    <p className="text-sm">
                                      {tr("Bestand", "Stock")}: {formatDisplayQuantity(item.unit, item.stock)} · {tr("Verfuegbar", "Available")}:{" "}
                                      {formatDisplayQuantity(item.unit, item.availableStock)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
