export type GeoJsonFeature = {
  id?: string | number;
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
