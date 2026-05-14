export type GeoJson = {
  features?: GeoJsonFeature[];
};

export type GeoJsonFeature = {
  id?: string | number;
  wikidataId?: string;
  properties?: Record<string, unknown>;
  geometry?: {
    type?: string;
    coordinates?: number[];
  };
};

export type PoiInput = {
  id: string;
  name: string;
  city: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  sourceHints: {
    wikipedia?: string;
    wikidata?: string;
  };
};

export type ResolutionMethod = "wikipedia_tag_en" | "wikidata_enwiki" | "geosearch_en";

export type ResolutionCandidate = {
  pageid?: number;
  title: string;
  distance?: number;
  source: ResolutionMethod;
};

export type ResolvedPage = {
  method: ResolutionMethod;
  candidates: ResolutionCandidate[];
  selected: {
    pageid?: number;
    title: string;
  };
};

export type WikiSnapshot = {
  fullText: string;
};
