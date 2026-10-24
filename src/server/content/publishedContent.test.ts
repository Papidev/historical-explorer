import { describe, expect, it } from "vitest";
import {
  publishedCityMapSchema,
  publishedPersonSchema,
  publishedPoiDetailSchema,
  publishedSourceSchema,
  type PublishedPerson,
  type PublishedPoiDetail,
} from "./publishedContent";

const poi = (): PublishedPoiDetail => ({
  id: "728cbdf6-2449-4991-99b0-75204603eaa0",
  city: "rome",
  name: "Colosseum",
  coordinates: { lat: 41.8902, lng: 12.4922 },
  categoryIds: [],
  publicationId: "d35edb45-bfcb-4a78-9ce6-a2307e4571f5",
  publishedAt: "2026-10-22T10:00:00.000Z",
  story: {
    textFormat: "markdown",
    introduction: { text: "A Roman amphitheatre.", sourceIds: ["wikipedia-en"] },
    topics: {
      history: [
        {
          id: "construction",
          description: "Built under Vespasian and Titus.",
          sourceIds: ["wikipedia-it"],
          time: { startYear: 70, endYear: 80, precision: "approximate", granularity: "year" },
        },
      ],
      design: [],
      art: [],
    },
    relatedPeople: [{ personId: "vespasian", name: "Vespasian", sourceIds: ["wikipedia-it"] }],
  },
  sources: [
    {
      id: "wikipedia-en",
      kind: "wikipedia",
      language: "en",
      pageId: 26964646,
      title: "Colosseum",
      url: "https://en.wikipedia.org/wiki/Colosseum",
      revisionId: 123456,
      acquiredAt: "2026-10-22T09:00:00.000Z",
    },
    {
      id: "wikipedia-it",
      kind: "wikipedia",
      language: "it",
      pageId: 7645,
      title: "Colosseo",
      url: "https://it.wikipedia.org/wiki/Colosseo",
      revisionId: 654321,
      acquiredAt: "2026-10-22T09:01:00.000Z",
    },
  ],
  gallery: [],
  mainImageId: null,
});

const person = (): PublishedPerson => ({
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
      id: "wikipedia",
      kind: "wikipedia",
      language: "en",
      pageId: 32364,
      title: "Vespasian",
      url: "https://en.wikipedia.org/wiki/Vespasian",
      revisionId: 123457,
      acquiredAt: "2026-10-22T09:02:00.000Z",
    },
  ],
  linkedPois: [
    {
      id: poi().id,
      city: "rome",
      name: "Colosseum",
      coordinates: { lat: 41.8902, lng: 12.4922 },
      categoryIds: [],
    },
  ],
  updatedAt: "2026-10-22T10:00:00.000Z",
});

describe("published POI detail", () => {
  it("preserves bilingual citations and permits an image placeholder and no Related People", () => {
    expect(publishedPoiDetailSchema.parse(poi())).toEqual(poi());
    const withoutPeople = poi();
    withoutPeople.story.relatedPeople = [];
    expect(publishedPoiDetailSchema.parse(withoutPeople).mainImageId).toBeNull();
  });

  it("requires a licensed gallery and a selected image from it", () => {
    const content = poi();
    content.gallery = [
      {
        id: "Colosseo_2020.jpg",
        commonsPageUrl: "https://commons.wikimedia.org/wiki/File:Colosseo_2020.jpg",
        thumbnailUrl: "https://upload.wikimedia.org/example-thumb.jpg",
        originalImageUrl: "https://upload.wikimedia.org/example.jpg",
        license: "CC BY-SA 4.0",
        attribution: "Example photographer",
      },
    ];
    content.mainImageId = "Colosseo_2020.jpg";
    expect(publishedPoiDetailSchema.parse(content).gallery).toEqual(content.gallery);
    content.mainImageId = null;
    expect(publishedPoiDetailSchema.safeParse(content).success).toBe(false);
    content.mainImageId = "absent.jpg";
    expect(publishedPoiDetailSchema.safeParse(content).success).toBe(false);
    content.mainImageId = "Colosseo_2020.jpg";
    content.gallery[0].license = "All rights reserved";
    expect(publishedPoiDetailSchema.safeParse(content).success).toBe(false);
    content.gallery[0].license = "CC0";
    content.gallery[0].attribution = "   ";
    expect(publishedPoiDetailSchema.safeParse(content).success).toBe(false);
  });

  it.each([
    {
      label: "unknown introduction Source",
      change: (value: PublishedPoiDetail) => {
        value.story.introduction.sourceIds = ["missing"];
      },
    },
    {
      label: "unknown Insight Source",
      change: (value: PublishedPoiDetail) => {
        value.story.topics.history[0].sourceIds = ["missing"];
      },
    },
    {
      label: "unknown relationship Source",
      change: (value: PublishedPoiDetail) => {
        value.story.relatedPeople[0].sourceIds = ["missing"];
      },
    },
    {
      label: "duplicate Insight IDs across topics",
      change: (value: PublishedPoiDetail) => {
        value.story.topics.design = [
          { id: "construction", description: "Stone arches.", sourceIds: ["wikipedia-en"] },
        ];
      },
    },
    {
      label: "duplicate Source IDs",
      change: (value: PublishedPoiDetail) => {
        value.sources[1].id = value.sources[0].id;
      },
    },
    {
      label: "wrong Wikipedia edition",
      change: (value: PublishedPoiDetail) => {
        value.sources[0].language = "it";
      },
    },
    {
      label: "invalid coordinates",
      change: (value: PublishedPoiDetail) => {
        value.coordinates.lat = 91;
      },
    },
    {
      label: "image selection without a gallery",
      change: (value: PublishedPoiDetail) => {
        value.mainImageId = "absent.jpg";
      },
    },
    {
      label: "duplicate Related People",
      change: (value: PublishedPoiDetail) => {
        value.story.relatedPeople.push(value.story.relatedPeople[0]);
      },
    },
  ])("rejects $label", ({ change }) => {
    const content = poi();
    change(content);
    expect(publishedPoiDetailSchema.safeParse(content).success).toBe(false);
  });

  it("rejects unresolved People, missing provenance and private fields", () => {
    const unresolved = {
      name: poi().story.relatedPeople[0].name,
      sourceIds: poi().story.relatedPeople[0].sourceIds,
    };
    expect(
      publishedPoiDetailSchema.safeParse({
        ...poi(),
        story: { ...poi().story, relatedPeople: [unresolved] },
      }).success,
    ).toBe(false);
    const untraceable = { ...poi().sources[0], revisionId: undefined };
    expect(
      publishedPoiDetailSchema.safeParse({ ...poi(), sources: [untraceable, poi().sources[1]] })
        .success,
    ).toBe(false);
    expect(
      publishedPoiDetailSchema.safeParse({ ...poi(), localPath: "/private/data" }).success,
    ).toBe(false);
    expect(
      publishedPoiDetailSchema.safeParse({
        ...poi(),
        sources: poi().sources.map((source) => ({
          ...source,
          content: "Private article text",
        })),
      }).success,
    ).toBe(false);
  });
});

describe("published city map", () => {
  it("validates categories against the city vocabulary and rejects broken hierarchies", () => {
    const map = {
      city: "rome",
      categoryDefinitions: [{ id: "architecture", name: "Architecture" }],
      pois: [{ ...person().linkedPois[0], categoryIds: ["architecture"] }],
    };
    expect(publishedCityMapSchema.parse(map)).toEqual(map);
    expect(publishedCityMapSchema.safeParse({ ...map, categoryDefinitions: [] }).success).toBe(
      false,
    );
    expect(
      publishedCityMapSchema.safeParse({ ...map, pois: [{ ...map.pois[0], city: "milan" }] })
        .success,
    ).toBe(false);
    expect(
      publishedCityMapSchema.safeParse({ ...map, pois: [map.pois[0], map.pois[0]] }).success,
    ).toBe(false);
    expect(
      publishedCityMapSchema.safeParse({
        ...map,
        categoryDefinitions: [...map.categoryDefinitions, ...map.categoryDefinitions],
      }).success,
    ).toBe(false);
    expect(
      publishedCityMapSchema.safeParse({
        ...map,
        categoryDefinitions: [{ ...map.categoryDefinitions[0], parentId: "absent" }],
      }).success,
    ).toBe(false);
    expect(
      publishedCityMapSchema.safeParse({
        ...map,
        categoryDefinitions: [
          { ...map.categoryDefinitions[0], parentId: "history" },
          { id: "history", name: "History", parentId: "architecture" },
        ],
      }).success,
    ).toBe(false);
    expect(
      publishedCityMapSchema.parse({ city: "rome", categoryDefinitions: [], pois: [] }).pois,
    ).toEqual([]);
  });
});

describe("published Person", () => {
  it("preserves shared identity and checks citations against the Person's own Sources", () => {
    expect(publishedPersonSchema.parse(person())).toEqual(person());
    const content = person();
    content.content.description[0].sourceIds = ["wikipedia-en"];
    expect(publishedPersonSchema.safeParse(content).success).toBe(false);
    content.content.description[0].sourceIds = ["wikipedia"];
    content.content.curiosities = [{ text: "A claim.", sourceIds: ["missing"] }];
    expect(publishedPersonSchema.safeParse(content).success).toBe(false);
  });

  it("rejects profiles without public POI links and duplicate inverse links", () => {
    expect(publishedPersonSchema.safeParse({ ...person(), linkedPois: [] }).success).toBe(false);
    expect(
      publishedPersonSchema.safeParse({
        ...person(),
        linkedPois: [...person().linkedPois, ...person().linkedPois],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate gallery filenames regardless of case", () => {
    const content = poi();
    content.gallery = [
      {
        id: "Colosseo.jpg",
        commonsPageUrl: "https://commons.wikimedia.org/wiki/File:Colosseo.jpg",
        thumbnailUrl: "https://upload.wikimedia.org/thumb.jpg",
        originalImageUrl: "https://upload.wikimedia.org/original.jpg",
        license: "CC0",
        attribution: "Example photographer",
      },
    ];
    content.gallery.push({ ...content.gallery[0], id: "colosseo.jpg" });
    content.mainImageId = "Colosseo.jpg";
    expect(publishedPoiDetailSchema.safeParse(content).success).toBe(false);
  });
});

describe("published Source", () => {
  it("reports malformed URLs as validation errors instead of throwing", () => {
    expect(publishedSourceSchema.safeParse({ ...poi().sources[0], url: "not a URL" }).success).toBe(
      false,
    );
    expect(
      publishedSourceSchema.safeParse({
        ...poi().sources[0],
        url: "https://example.com/wiki/Colosseum",
      }).success,
    ).toBe(false);
    expect(
      publishedSourceSchema.safeParse({
        ...poi().sources[0],
        url: "http://en.wikipedia.org/wiki/Colosseum",
      }).success,
    ).toBe(false);
  });
});
