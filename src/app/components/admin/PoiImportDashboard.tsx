"use client";

import { useState } from "react";
import type { AdminPoiListItem } from "@/utils/admin/poiImport";
import { PoiListColumn } from "@/app/components/admin/PoiListColumn";

type Props = {
  rawPois: AdminPoiListItem[];
  targetPois: AdminPoiListItem[];
};

const matchesQuery = (item: AdminPoiListItem, query: string) => {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  return item.id.toLowerCase().includes(normalized) || item.name.toLowerCase().includes(normalized);
};

export const PoiImportDashboard = ({ rawPois, targetPois }: Props) => {
  const [query, setQuery] = useState("");

  const filteredRawPois = rawPois.filter((item) => matchesQuery(item, query));
  const filteredTargetPois = targetPois.filter((item) => matchesQuery(item, query));

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6">
      <header className="border-b border-black/10 pb-4 pt-4">
        <h1 className="text-xl font-semibold text-black">POI Import</h1>
        <p className="mt-1 text-sm text-black/65">
          Raw: {rawPois.length} · Selected: {targetPois.length}
        </p>
      </header>

      <div className="pt-4">
        <label htmlFor="poi-search" className="mb-1 block text-sm font-medium text-black/80">
          Search POI
        </label>
        <input
          id="poi-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or id"
          className="w-full rounded-md border border-black/20 bg-white px-3 py-2 text-sm text-black outline-none ring-0 placeholder:text-black/45 focus:border-black/50"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 py-4 lg:grid-cols-2">
        <PoiListColumn
          title="Raw POIs"
          items={filteredRawPois}
          emptyLabel={query ? "No POIs match this filter." : "No POIs available."}
        />
        <PoiListColumn
          title="Selected POIs"
          items={filteredTargetPois}
          emptyLabel={query ? "No POIs match this filter." : "No POIs available."}
        />
      </div>
    </div>
  );
};
