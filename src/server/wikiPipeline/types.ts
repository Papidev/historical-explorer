export type GeoJson = {
  type?: string;
  generator?: string;
  copyright?: string;
  timestamp?: string;
  features?: GeoJsonFeature[];
};

export type GeoJsonFeature = {
  id?: string | number;
  wikidataId?: string;
  geoPlaceId?: string;
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
    wikimediaCommons?: string;
  };
};

export type WikipediaLanguage = "en" | "it";

export type ResolutionMethod =
  | "wikipedia_tag_en"
  | "wikipedia_tag_it"
  | "wikidata_enwiki"
  | "wikidata_itwiki"
  | "name_enwiki"
  | "name_itwiki"
  | "coordinates_enwiki"
  | "coordinates_itwiki";

export type ResolutionCandidate = {
  title: string;
  source: ResolutionMethod;
};

export type ResolvedPage = {
  method: ResolutionMethod;
  candidates: ResolutionCandidate[];
  selected: {
    title: string;
    language?: WikipediaLanguage;
  };
};

export type WikiSnapshot = {
  fullText: string;
  links: Array<{ label: string; title: string; language?: WikipediaLanguage }>;
  title: string;
  language?: WikipediaLanguage;
  wikidataId?: string;
  isDisambiguation?: boolean;
};

export type MainImageDiscoveredVia = "wikidata-p18" | "wikipedia-page-image" | "commons-category";

export type MainImageCandidate = {
  commonsFileName: string;
  commonsPageUrl: string;
  thumbnailUrl: string;
  originalImageUrl: string;
  license?: string;
  attribution?: string;
  author?: string;
  width?: number;
  height?: number;
  discoveredVia: MainImageDiscoveredVia;
  isProposed: boolean;
};

export type MainImageCandidatesArtifact = {
  candidates: MainImageCandidate[];
  selectedCommonsFileName?: string;
};
