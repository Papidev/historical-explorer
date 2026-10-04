import type { PublicPerson } from "@/server/person/types";
import type { PublicStoryContent } from "@/server/storyWorkflow/storyContent";
import type { Poi } from "@/types/Poi";

export type PublicCatalog = {
  version: 1;
  city: string;
  pois: Array<{
    poi: Poi;
    storyContent: PublicStoryContent;
    mainImage: {
      thumbnailUrl: string;
      originalImageUrl: string;
      commonsPageUrl: string;
      license: string;
      attribution: string;
    };
  }>;
  people: PublicPerson[];
};
