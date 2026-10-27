import type {
  PublishedCityPreview,
  PublishedPerson,
  PublishedPoiDetail,
} from "@/server/content/publishedContent";
import type { Poi } from "@/types/Poi";
import type { PoiCategoryDefinition } from "@/types/PoiCategory";
import type { PublicPerson } from "@/server/person/types";
import { toPublicStoryContent } from "@/server/storyWorkflow/storyContent";
import { toWikipediaSources } from "@/server/wikipediaSources";

export const toVisitorCity = (city: PublishedCityPreview) => ({
  pois: city.pois.map(({ categoryIds, mainImage, introduction, wikidataId, ...poi }): Poi => ({
    ...poi,
    ...(wikidataId ? { wikidataId } : {}),
    categories: categoryIds,
    funFacts: [],
    // Preview text stays plain; the detail renderer handles the full Markdown.
    previewDescription: introduction
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_#>`]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
    ...(mainImage ? { mainImageUrl: mainImage.thumbnailUrl } : {}),
  })),
  categoryDefinitions: city.categoryDefinitions.map(
    ({ parentId, ...category }): PoiCategoryDefinition => ({
      ...category,
      ...(parentId ? { parent: parentId } : {}),
    }),
  ),
});

export const toVisitorStory = (detail: PublishedPoiDetail) => ({
  ...toPublicStoryContent({
    ...detail.story,
    wikipediaSources: toWikipediaSources(detail.sources),
  }),
  // Online references are already resolved and validated at publication time.
  relatedPeople: detail.story.relatedPeople.map(({ personId, name }) => ({ personId, name })),
});

export const toVisitorPerson = (person: PublishedPerson): PublicPerson => ({
  id: person.id,
  name: person.name,
  textFormat: person.textFormat,
  description: person.content.description.map(({ text }) => text) as [string, string],
  curiosities: person.content.curiosities.map(({ text }) => text),
  birthDate: person.content.birthDate,
  deathDate: person.content.deathDate,
  wikipediaSources: toWikipediaSources(person.sources),
});
