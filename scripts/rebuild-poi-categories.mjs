import { readdirSync } from "node:fs";
import { createPoiCategoriesForCity } from "../src/server/poiCategories/index.ts";

for (const entry of readdirSync(new URL("../data/", import.meta.url), { withFileTypes: true })) {
  if (entry.isDirectory()) createPoiCategoriesForCity(entry.name).rebuild();
}
console.log("Rebuilt POI categories across city catalogs.");
