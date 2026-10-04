import type { PublicPerson } from "@/server/person/types";
import type { PublicStoryContent } from "@/server/storyWorkflow/storyContent";
import type { Poi } from "@/types/Poi";
import type { PoiCategoryDefinition } from "@/types/PoiCategory";

export type PublicCatalog = {
  version: 1;
  city: string;
  categoryDefinitions: PoiCategoryDefinition[];
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
