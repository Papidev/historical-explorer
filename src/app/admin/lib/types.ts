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
  mdxPoi?: PoiItem;
  rawUpdatedAt?: string;
  transformedUpdatedAt?: string;
  wikiUpdatedAt?: string;
  mdxUpdatedAt?: string;
  transformedJson?: string;
  wikiJson?: string;
  mdxContent?: string;
  mdxSource?: MDXRemoteSerializeResult<Record<string, unknown>, Record<string, unknown>>;
};
