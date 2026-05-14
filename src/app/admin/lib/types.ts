import type { MDXRemoteSerializeResult } from "next-mdx-remote";

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

export type AdminPoiRow = {
  id: string;
  rawPoi?: PoiItem;
  transformedPoi?: PoiItem;
  wikiPoi?: PoiItem;
  aiPoi?: PoiItem;
  mdxPoi?: PoiItem;
  rawUpdatedAt?: string;
  transformedUpdatedAt?: string;
  wikiUpdatedAt?: string;
  aiUpdatedAt?: string;
  mdxUpdatedAt?: string;
  transformedGenerationDuration?: string;
  wikiGenerationDuration?: string;
  aiGenerationDuration?: string;
  mdxGenerationDuration?: string;
  transformedJson?: string;
  wikiText?: string;
  aiText?: string;
  aiSource?: MDXRemoteSerializeResult<
    Record<string, unknown>,
    Record<string, unknown>
  >;
  mdxContent?: string;
  mdxSource?: MDXRemoteSerializeResult<
    Record<string, unknown>,
    Record<string, unknown>
  >;
};
