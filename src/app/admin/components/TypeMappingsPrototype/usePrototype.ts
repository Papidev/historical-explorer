// Throwaway UI model for #60. Never writes catalog files or calls admin actions.
import { useState } from "react";
import type { AdminPoiRow } from "../../lib/types";
import { POI_CATEGORIES, type PoiCategory } from "@/types/PoiCategory";
import initialMapping from "../../../../../data/poi-type-category-map.json";

export const usePrototype = (rows: AdminPoiRow[]) => {
  const [rules, setRules] = useState<Record<string, PoiCategory[]>>(initialMapping.mappings as Record<string, PoiCategory[]>);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [message, setMessage] = useState("Changes are simulated in memory. Reload to reset.");
  const types = [...new Map(rows.flatMap(row => row.poiTypes?.types ?? []).map(type => [type.id, type])).values()]
    .map(type => ({...type, pois: rows.filter(row => row.poiTypes?.types.some(({id}) => id === type.id)), categories: rules[type.id], status: rules[type.id] === undefined ? "Unmapped" : rules[type.id].length ? "Mapped" : "Ignored"}))
    .sort((a,b) => a.label.localeCompare(b.label));
  const visibleTypes = types.filter(type => (status === "All" || type.status === status) && `${type.label} ${type.id}`.toLowerCase().includes(query.toLowerCase()));
  const selected = types.find(type => type.id === selectedId) ?? visibleTypes[0];
  return {
    rules, types, visibleTypes, selected, query, setQuery, status, setStatus, setSelectedId, message,
    missingTypes: rows.filter(row => !row.poiTypes?.types.length),
    save: (id: string, categories: PoiCategory[] | undefined) => {
      setRules(previous => {
        const next = {...previous};
        if (categories === undefined) delete next[id];
        else next[id] = categories;
        return next;
      });
      setMessage(`Simulated save: ${types.find(type => type.id === id)?.label} → ${categories === undefined ? "Unmapped" : categories.length ? categories.join(", ") : "Ignored"}. ${types.find(type => type.id === id)?.pois.length ?? 0} Rome POIs recalculated in this preview.`);
    },
    preview: rows.map(row => {
      const name = row.transformedPoi?.name ?? row.rawPoi?.name ?? row.id;
      let categories = [...new Set((row.poiTypes?.types ?? []).flatMap(({id}) => rules[id] ?? []))];
      if (categories.some(category => ["Church", "Cathedral", "Basilica"].includes(category))) {
        if (/\bbasilica\b/i.test(name)) categories = [...new Set([...categories.filter(category => category !== "Cathedral"), "Basilica" as const])];
        else if (/\b(cathedral|cattedrale)\b/i.test(name)) categories = [...new Set([...categories, "Cathedral" as const])];
        else if (categories.includes("Cathedral")) categories = [...new Set([...categories.filter(category => category !== "Cathedral"), "Church" as const])];
      }
      return {id: row.id, name, categories};
    }),
    categories: POI_CATEGORIES,
  };
};
export type PrototypeModel = ReturnType<typeof usePrototype>;
