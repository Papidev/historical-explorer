import type { MDXRemoteSerializeResult } from "next-mdx-remote";

export type Poi = {
  id: string;
  name: string;
  city: string;
  coordinates: { lat: number; lng: number };
  period: string;
  shortDescription: string;
  dialogContentMdx?: MDXRemoteSerializeResult;
  funFacts: string[];
};
