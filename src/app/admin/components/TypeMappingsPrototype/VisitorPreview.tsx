import { useState } from "react";
import { ListboxSelect } from "@/app/components/ui/ListboxSelect";
import { matchesPoiCategory, type PoiCategory } from "@/types/PoiCategory";
import type { PrototypeModel } from "./usePrototype";

export const VisitorPreview = ({model}:{model: PrototypeModel}) => {
  const [category,setCategory] = useState("All");
  const pois = model.preview.filter(poi => category === "All" || matchesPoiCategory(poi.categories, category as PoiCategory));
  return <details className="mt-6 rounded-lg border border-gray-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-gray-800">Visitor filter preview · Rome · {pois.length} matching POIs</summary><div className="mt-4 max-w-sm"><ListboxSelect label="Preview category" value={category} onChange={setCategory} options={[{label:"All POIs",value:"All"},...model.categories.map(value => ({value,label:value}))]}/></div><ul className="mt-4 grid max-h-64 gap-2 overflow-auto text-sm sm:grid-cols-2">{pois.map(poi => <li key={poi.id} className="rounded-md bg-gray-50 p-3"><p className="font-medium text-gray-800">{poi.name}</p><p className="text-xs text-gray-500">{poi.categories.join(", ") || "Uncategorized"}</p></li>)}</ul>{!pois.length && <p className="mt-4 text-sm text-gray-500">No matching POIs.</p>}<p className="mt-3 text-xs text-gray-500">Uses the simulated rules. The live visitor map is unchanged.</p></details>;
};
