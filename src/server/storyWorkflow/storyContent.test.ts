import { describe, expect, it } from "vitest";
import { parseStoryContent, type HistoryInsight, type StoryContent } from "./storyContent";

const validStoryContent = (): StoryContent => ({
  introduction: {
    text: "Forum Boarium was Rome's ancient cattle market.",
    sourceIds: ["wikipedia"],
  },
  topics: {
    history: [],
    design: [],
    art: [],
  },
  relatedPeople: [],
});

describe("Story Content", () => {
  it("accepts an Introduction when every optional Story Topic is empty", () => {
    expect(parseStoryContent(validStoryContent(), ["wikipedia"])).toEqual(validStoryContent());
  });

  it("accepts dated and undated History Insights linked to Related People", () => {
    const content = validStoryContent();
    content.relatedPeople.push({
      id: "donato-bramante",
      name: "Donato Bramante",
      relationship: "Designed the cloister.",
      sourceIds: ["wikipedia"],
    });
    content.topics.history.push(
      {
        id: "construction",
        description: "The cloister was commissioned around 1500.",
        relatedPersonIds: ["donato-bramante"],
        sourceIds: ["wikipedia"],
        time: {
          startYear: 1500,
          precision: "approximate",
          granularity: "year",
        },
      },
      {
        id: "later-use",
        description: "The building later became an exhibition venue.",
        relatedPersonIds: [],
        sourceIds: ["wikipedia"],
      },
      {
        id: "ancient-period",
        description: "The site was used across two centuries BC.",
        relatedPersonIds: [],
        sourceIds: ["wikipedia"],
        time: {
          startYear: -600,
          endYear: -401,
          precision: "approximate",
          granularity: "century",
        },
      },
    );

    expect(parseStoryContent(content, ["wikipedia"])).toEqual(content);
  });

  it.each([
    [{ startYear: 0, precision: "exact", granularity: "year" }, "Year zero"],
    [{ startYear: 400, endYear: 301, precision: "exact", granularity: "century" }, "End year"],
    [{ startYear: 301, precision: "exact", granularity: "century" }, "Century"],
  ])("rejects invalid historical time %o", (time, message) => {
    const content = validStoryContent();
    content.topics.history.push({
      id: "invalid-time",
      description: "Invalid history.",
      relatedPersonIds: [],
      sourceIds: ["wikipedia"],
      time: time as HistoryInsight["time"],
    });

    expect(() => parseStoryContent(content, ["wikipedia"])).toThrow(message);
  });

  it("rejects duplicate Insights, dangling references, and unlinked Related People", () => {
    const duplicate = validStoryContent();
    const insight = {
      id: "same-id",
      description: "An insight.",
      relatedPersonIds: [],
      sourceIds: ["wikipedia"],
    };
    duplicate.topics.design.push(insight);
    duplicate.topics.art.push(insight);
    expect(() => parseStoryContent(duplicate, ["wikipedia"])).toThrow("duplicated");

    const duplicateAcrossKinds = validStoryContent();
    duplicateAcrossKinds.relatedPeople.push({
      id: "same-id",
      name: "Same ID",
      relationship: "Linked person.",
      sourceIds: ["wikipedia"],
    });
    duplicateAcrossKinds.topics.design.push({
      ...insight,
      relatedPersonIds: ["same-id"],
    });
    expect(() => parseStoryContent(duplicateAcrossKinds, ["wikipedia"])).toThrow("duplicated");

    const danglingSource = validStoryContent();
    danglingSource.introduction.sourceIds = ["unknown"];
    expect(() => parseStoryContent(danglingSource, ["wikipedia"])).toThrow("unknown Source");

    const danglingPerson = validStoryContent();
    danglingPerson.topics.design.push({
      ...insight,
      relatedPersonIds: ["unknown-person"],
    });
    expect(() => parseStoryContent(danglingPerson, ["wikipedia"])).toThrow(
      "unknown Related Person",
    );

    const unlinkedPerson = validStoryContent();
    unlinkedPerson.relatedPeople.push({
      id: "unlinked",
      name: "Unlinked Person",
      relationship: "No relationship to an insight.",
      sourceIds: ["wikipedia"],
    });
    expect(() => parseStoryContent(unlinkedPerson, ["wikipedia"])).toThrow("not linked");
  });
});
