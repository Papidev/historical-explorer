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
  transformedJson?: string;
  wikiJson?: string;
  mdxContent?: string;
};
