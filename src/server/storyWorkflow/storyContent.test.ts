import { describe, expect, it } from "vitest";
import {
  toPublicStoryContent,
  parseStoryContent,
  type HistoryInsight,
  type StoryContent,
} from "./storyContent";

const validStoryContent = (): StoryContent => ({
  introduction: {
    text: "Forum Boarium was Rome's ancient cattle market.",
    sourceIds: ["wikipedia"],
  },
  topics: { history: [], design: [], art: [] },
  relatedPeople: [],
});

describe("Story Content", () => {
  it("preserves Markdown and its format in the public Story, including mentioned people", () => {
    const content = validStoryContent();
    content.textFormat = "markdown";
    content.introduction.text =
      "A temple beside the river.\n\n**John Smith** restored its *bronze doors*.";
    content.topics.art = [
      { id: "doors", description: "The **bronze doors** survive.", sourceIds: ["wikipedia"] },
    ];
    content.relatedPeople = [
      { name: "John Smith", personId: "john-smith", sourceIds: ["wikipedia"] },
    ];

    expect(toPublicStoryContent(parseStoryContent(content, ["wikipedia"]))).toMatchObject({
      textFormat: "markdown",
      introduction: content.introduction.text,
      topics: { art: [{ description: "The **bronze doors** survive." }] },
      relatedPeople: [{ name: "John Smith", personId: "john-smith" }],
    });
    expect(toPublicStoryContent(validStoryContent())).not.toHaveProperty("textFormat");
    expect(() => parseStoryContent({ ...content, textFormat: "mdx" }, ["wikipedia"])).toThrow();
  });

  it("keeps selective emphasis and only mentioned people with distinct Person IDs", () => {
    const content = validStoryContent();
    content.introduction.text += " JOHN  SMITH worked here. The annex was restored.";
    content.introduction.emphasis = ["ancient cattle market"];
    content.topics.design.push({
      id: "temples",
      description: "Temples stand beside the market.",
      sourceIds: ["wikipedia"],
      emphasis: ["Temples"],
    });
    content.topics.history.push({
      id: "commission",
      description: "Commissioned by Pope Innocent\u202fX.",
      sourceIds: ["wikipedia"],
    });
    content.relatedPeople = [
      { name: "John Smith (architect)", personId: "smith-architect", sourceIds: ["wikipedia"] },
      { name: "John Smith (explorer)", personId: "smith-explorer", sourceIds: ["wikipedia"] },
      { name: "Filippo Baldinucci", personId: "filippo-baldinucci", sourceIds: ["wikipedia"] },
      { name: "Pope Innocent X", personId: "pope-innocent-x", sourceIds: ["wikipedia"] },
      { name: "Ann", personId: "ann", sourceIds: ["wikipedia"] },
    ];
    expect(toPublicStoryContent(content).relatedPeople).toEqual([
      { name: "John Smith", personId: "smith-architect" },
      { name: "John Smith", personId: "smith-explorer" },
      { name: "Pope Innocent X", personId: "pope-innocent-x" },
    ]);
    expect(content.relatedPeople[0].name).toBe("John Smith (architect)");
    expect(toPublicStoryContent(parseStoryContent(content, ["wikipedia"]))).toMatchObject({
      introductionEmphasis: ["ancient cattle market"],
      topics: {
        design: [{ description: "Temples stand beside the market.", emphasis: ["Temples"] }],
      },
    });
  });
  it("accepts up to ten Related People without requiring Insight links", () => {
    const content = validStoryContent();
    content.relatedPeople = Array.from({ length: 10 }, (_, index) => ({
      name: `Person ${index + 1}`,
      ...(index === 0 ? { personId: "person-1" } : {}),
      sourceIds: ["wikipedia"],
    }));
    expect(parseStoryContent(content, ["wikipedia"])).toEqual(content);
    expect(toPublicStoryContent(content)).not.toHaveProperty("introductionEmphasis");
    expect(() =>
      parseStoryContent(
        {
          ...content,
          relatedPeople: [...content.relatedPeople, { name: "Eleventh", sourceIds: ["wikipedia"] }],
        },
        ["wikipedia"],
      ),
    ).toThrow("Too big");
  });

  it("sorts dated History Insights and accepts undated Insights", () => {
    const content = validStoryContent();
    content.topics.history.push(
      {
        id: "construction",
        description: "The cloister was commissioned around 1500.",
        sourceIds: ["wikipedia"],
        time: { startYear: 1500, precision: "approximate", granularity: "year" },
      },
      {
        id: "later-use",
        description: "The building later became a venue.",
        sourceIds: ["wikipedia"],
      },
      {
        id: "ancient-period",
        description: "The site was used across two centuries BC.",
        sourceIds: ["wikipedia"],
        time: { startYear: -600, endYear: -401, precision: "approximate", granularity: "century" },
      },
    );
    expect(parseStoryContent(content, ["wikipedia"]).topics.history.map(({ id }) => id)).toEqual([
      "ancient-period",
      "construction",
      "later-use",
    ]);
  });

  it.each(["exact", "approximate"] as const)(
    "accepts a single century without inventing an end year (%s)",
    (precision) => {
      const content = validStoryContent();
      content.topics.history.push({
        id: "century",
        description: "Restoration in the tenth century.",
        sourceIds: ["wikipedia"],
        time: { startYear: 1000, precision, granularity: "century" },
      });
      expect(parseStoryContent(content, ["wikipedia"]).topics.history[0].time).toEqual({
        startYear: 1000,
        precision,
        granularity: "century",
      });
    },
  );

  it.each([
    [{ startYear: 0, precision: "exact", granularity: "year" }, "Year zero"],
    [{ startYear: 400, endYear: 301, precision: "exact", granularity: "century" }, "End year"],
  ])("rejects invalid historical time %o", (time, message) => {
    const content = validStoryContent();
    content.topics.history.push({
      id: "invalid-time",
      description: "Invalid history.",
      sourceIds: ["wikipedia"],
      time: time as HistoryInsight["time"],
    });
    expect(() => parseStoryContent(content, ["wikipedia"])).toThrow(message);
  });

  it("rejects duplicate Insight IDs, unknown Sources, and emphasis absent from the text", () => {
    const duplicate = validStoryContent();
    const insight = { id: "same-id", description: "An insight.", sourceIds: ["wikipedia"] };
    duplicate.topics.design.push(insight);
    duplicate.topics.art.push(insight);
    expect(() => parseStoryContent(duplicate, ["wikipedia"])).toThrow("duplicated");

    const danglingSource = validStoryContent();
    danglingSource.relatedPeople.push({ name: "Unknown", sourceIds: ["unknown"] });
    expect(() => parseStoryContent(danglingSource, ["wikipedia"])).toThrow("unknown Source");

    const invalidEmphasis = validStoryContent();
    invalidEmphasis.introduction.emphasis = ["not in the text"];
    expect(() => parseStoryContent(invalidEmphasis, ["wikipedia"])).toThrow("absent from its text");
    invalidEmphasis.introduction.emphasis = [];
    invalidEmphasis.topics.art.push({
      id: "art",
      description: "An artwork.",
      sourceIds: ["wikipedia"],
      emphasis: ["another artwork"],
    });
    expect(() => parseStoryContent(invalidEmphasis, ["wikipedia"])).toThrow("absent from its text");
  });
});
