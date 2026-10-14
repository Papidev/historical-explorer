import { z } from "zod";

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

export type WikipediaLanguage = string;

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

export const mainImageCandidateSchema = z
  .object({
    commonsFileName: z.string().min(1),
    commonsPageUrl: z.url(),
    thumbnailUrl: z.url(),
    originalImageUrl: z.url(),
    license: z.string().optional(),
    attribution: z.string().optional(),
    author: z.string().optional(),
    width: z.number().int().nonnegative().optional(),
    height: z.number().int().nonnegative().optional(),
    discoveredVia: z.enum(["wikidata-p18", "wikipedia-page-image", "commons-category"]),
    isProposed: z.boolean(),
  })
  .strict();

export type MainImageCandidate = z.infer<typeof mainImageCandidateSchema>;

export type MainImageDiscoveredVia = MainImageCandidate["discoveredVia"];

export const mainImageCandidatesArtifactSchema = z
  .object({
    candidates: z.array(mainImageCandidateSchema),
    selectedCommonsFileName: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((artifact, context) => {
    if (
      artifact.selectedCommonsFileName &&
      !artifact.candidates.some(
        (candidate) => candidate.commonsFileName === artifact.selectedCommonsFileName,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["selectedCommonsFileName"],
        message: "Selected Main Image must reference an available candidate.",
      });
    }
  });

export type MainImageCandidatesArtifact = z.infer<typeof mainImageCandidatesArtifactSchema>;
