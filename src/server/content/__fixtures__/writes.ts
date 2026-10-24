import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { storyWriteSchema } from "../postgresContent";

export const exampleStoryWrite = (): z.infer<typeof storyWriteSchema> => {
  const source = {
    id: "wikipedia",
    kind: "wikipedia" as const,
    language: "en",
    pageId: 26964646,
    title: "Colosseum",
    url: "https://en.wikipedia.org/wiki/Colosseum",
    revisionId: 123456,
    acquiredAt: "2026-10-22T09:00:00.000Z",
  };
  const summary = {
    id: randomUUID(),
    city: "rome",
    name: "Colosseum",
    coordinates: { lat: 41.8902, lng: 12.4922 },
    categoryIds: [],
  };
  const generation = {
    provider: "ollama",
    model: "example-model",
    completedAt: "2026-10-22T10:00:00.000Z",
  };
  return {
    inputRevision: randomUUID(),
    expectedPublicationId: null,
    detail: {
      ...summary,
      publicationId: randomUUID(),
      publishedAt: generation.completedAt,
      story: {
        textFormat: "markdown",
        introduction: { text: "A Roman amphitheatre.", sourceIds: ["wikipedia"] },
        topics: { history: [], design: [], art: [] },
        relatedPeople: [{ personId: "vespasian", name: "Vespasian", sourceIds: ["wikipedia"] }],
      },
      sources: [source],
      gallery: [],
      mainImageId: null,
    },
    generation,
    people: [
      {
        profileVersion: randomUUID(),
        wikidataId: "Q1419",
        generation,
        person: {
          id: "vespasian",
          name: "Vespasian",
          textFormat: "markdown",
          content: {
            description: [
              { text: "A Roman emperor.", sourceIds: ["wikipedia"] },
              { text: "He commissioned the amphitheatre.", sourceIds: ["wikipedia"] },
            ],
            curiosities: [],
          },
          sources: [
            {
              ...source,
              pageId: 32364,
              title: "Vespasian",
              url: "https://en.wikipedia.org/wiki/Vespasian",
            },
          ],
          linkedPois: [summary],
          updatedAt: generation.completedAt,
        },
      },
    ],
  };
};
