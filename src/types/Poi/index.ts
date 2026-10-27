import type { PoiCategory } from "@/types/PoiCategory";

export type Poi = {
  id: string;
  wikidataId?: string;
  categories?: PoiCategory[];
  name: string;
  city: string;
  coordinates: { lat: number; lng: number };
  address?: string;
  period?: string;
  shortDescription?: string;
  previewDescription?: string;
  mainImageUrl?: string;
  funFacts: string[];
};
