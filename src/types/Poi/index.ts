export type Poi = {
  id: string;
  name: string;
  city: string;
  coordinates: { lat: number; lng: number };
  address?: string;
  period?: string;
  shortDescription?: string;
  funFacts: string[];
};
