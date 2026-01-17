export type Poi = {
  id: string;
  name: string;
  city: string;
  coordinates: { lat: number; lng: number };
  period: string;
  shortDescription: string;
  funFacts: string[];
};