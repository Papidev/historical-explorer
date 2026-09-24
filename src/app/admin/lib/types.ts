import type { Source, StoryContent } from "@/server/storyWorkflow";

export type AdminActionWarning = {
  title: string;
  description?: string;
  details?: string;
};

export type AdminActionResult = {
  warning?: AdminActionWarning;
};

export type AdminAction = (formData: FormData) => Promise<AdminActionResult | void>;

export type GeoJsonFeature = {
  id?: string | number;
  wikidataId?: string;
  properties?: Record<string, unknown>;
};

export type GeoJson = {
  features?: GeoJsonFeature[];
};

export type PoiItem = {
  id: string;
  name: string;
  wikidata?: string;
  featureIndex: number;
};

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
  discoveredVia: "wikidata-p18" | "wikipedia-page-image";
  isProposed: boolean;
};

export type MainImageCandidatesArtifact = {
  candidates: MainImageCandidate[];
  selectedCommonsFileName?: string;
};

export type AdminArtifact = {
  label: string;
  path: string;
  content: string;
  versioned: boolean;
};

export type RelatedPersonArtifacts = {
  name: string;
  personId?: string;
  resolutionError?: string;
  artifacts: AdminArtifact[];
};

export type AdminPoiArtifacts = {
  geoPlace?: AdminArtifact;
  pointOfInterest?: AdminArtifact;
  wikipediaText?: AdminArtifact;
  wikipediaMetadata?: AdminArtifact;
  storyContent?: AdminArtifact;
  mainImageCandidates?: AdminArtifact;
  generationMetadata?: AdminArtifact;
  relatedPeople: RelatedPersonArtifacts[];
};

export type AdminPoiRow = {
  id: string;
  rawPoi?: PoiItem;
  transformedPoi?: PoiItem;
  wikiPoi?: PoiItem;
  mainImagePoi?: PoiItem;
  rawUpdatedAt?: string;
  transformedUpdatedAt?: string;
  wikiUpdatedAt?: string;
  mainImageUpdatedAt?: string;
  transformedGenerationDuration?: string;
  wikiGenerationDuration?: string;
  mainImageGenerationDuration?: string;
  storyContentUpdatedAt?: string;
  storyContentGenerationDuration?: string;
  relatedPeopleUpdatedAt?: string;
  relatedPeopleGenerationDuration?: string;
  storyContentGenerationMode?: string;
  storyContentGenerationProvider?: string;
  storyContentGenerationModel?: string;
  transformedJson?: string;
  wikiText?: string;
  storyContent?: StoryContent;
  storyContentSources?: Source[];
  mainImageArtifact?: MainImageCandidatesArtifact;
  artifacts?: AdminPoiArtifacts;
};
