import type { PoiCategory, PoiCategoryDefinition } from "./PoiCategory";

export type MappingPoi = { id: string; name: string; city: string };
export type PoiTypeMapping = {
  id: string;
  label: string;
  categories?: PoiCategory[];
  pois: MappingPoi[];
  origin?: "initial" | "manual" | "automatic";
  reason?: string;
};
export type TypeMappingCatalog = {
  version: number;
  types: PoiTypeMapping[];
  missingTypes: MappingPoi[];
  categories?: PoiCategoryDefinition[];
};
export type SaveTypeMapping = (
  id: string,
  categories: PoiCategory[] | null,
) => Promise<{ updatedPois: number; cities: string[] }>;

export type CategoryActions = {
  move: (id: string, parent: string | null) => Promise<{ updatedPois: number; cities: string[] }>;
  save: (id: string | null, name: string) => Promise<{ updatedPois: number; cities: string[] }>;
  delete: (id: string) => Promise<{ updatedPois: number; cities: string[] }>;
};
export type ClassifyTypeMappings = (
  formData: FormData,
) => Promise<{
  classified: number;
  updatedPois: number;
  cities: string[];
  createdCategories: number;
}>;
