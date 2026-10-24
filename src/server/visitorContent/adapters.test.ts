import { describe, expect, it } from "vitest";
import { exampleStoryWrite } from "@/server/content/__fixtures__/writes";
import { toVisitorCity, toVisitorPerson, toVisitorStory } from "./adapters";

describe("online visitor presentation", () => {
  it("keeps image-free POIs visible and retains category identity and hierarchy", () => {
    const { detail } = exampleStoryWrite();
    const city = toVisitorCity({
      city: "rome",
      categoryDefinitions: [
        { id: "architecture", name: "Architecture" },
        { id: "amphitheatre", name: "Amphitheatre", parentId: "architecture" },
      ],
      pois: [
        {
          id: detail.id,
          city: "rome",
          name: detail.name,
          coordinates: detail.coordinates,
          categoryIds: ["amphitheatre"],
          mainImage: null,
          introduction: "A **Roman** [amphitheatre](https://example.com).\n\nIn Rome.",
        },
      ],
    });
    expect(city.pois[0]).toMatchObject({
      id: detail.id,
      categories: ["amphitheatre"],
      previewDescription: "A Roman amphitheatre. In Rome.",
    });
    expect(city.pois[0].mainImageUrl).toBeUndefined();
    expect(city.categoryDefinitions[1]).toMatchObject({
      id: "amphitheatre",
      parent: "architecture",
    });
  });

  it("preserves published People references, Markdown, history dates and Wikipedia editions", () => {
    const { detail } = exampleStoryWrite();
    detail.story.topics.history = [
      {
        id: "history",
        description: "**Building** began.",
        time: { startYear: 72, granularity: "year", precision: "approximate" },
        sourceIds: ["wikipedia"],
      },
    ];
    expect(toVisitorStory(detail)).toMatchObject({
      textFormat: "markdown",
      introduction: "A Roman amphitheatre.",
      relatedPeople: [{ personId: "vespasian", name: "Vespasian" }],
      topics: { history: [{ description: "**Building** began.", time: { startYear: 72 } }] },
      wikipediaSources: [{ title: "Colosseum", url: "https://en.wikipedia.org/wiki/Colosseum" }],
    });
    expect(JSON.stringify(toVisitorStory(detail))).not.toContain("sourceIds");
  });

  it("renders the saved shared Person without requiring a legacy profile or image", () => {
    const person = exampleStoryWrite().people[0].person;
    person.content.description[0].text = "A **Roman** emperor.";
    const visitor = toVisitorPerson(person);
    expect(visitor).toMatchObject({
      id: "vespasian",
      textFormat: "markdown",
      description: ["A **Roman** emperor.", "He commissioned the amphitheatre."],
      wikipediaSources: [{ title: "Vespasian" }],
    });
    expect(visitor.image).toBeUndefined();
  });
});
