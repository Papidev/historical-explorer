import { describe, expect, it } from "vitest";
import { parseStoryContent, type HistoryInsight, type StoryContent } from "./storyContent";

const validStoryContent = (): StoryContent => ({
  introduction: { text: "Forum Boarium was Rome's ancient cattle market.", sourceIds: ["wikipedia"] },
  topics: { history: [], design: [], art: [] },
  relatedPeople: [],
});

describe("Story Content", () => {
  it("accepts up to ten Related People without requiring Insight links", () => {
    const content = validStoryContent();
    content.relatedPeople = Array.from({ length: 10 }, (_, index) => ({
      name: `Person ${index + 1}`,
      ...(index === 0 ? { personId: "person-1" } : {}),
      sourceIds: ["wikipedia"],
    }));
    expect(parseStoryContent(content, ["wikipedia"])).toEqual(content);
    expect(() =>
      parseStoryContent(
        { ...content, relatedPeople: [...content.relatedPeople, { name: "Eleventh", sourceIds: ["wikipedia"] }] },
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
      { id: "later-use", description: "The building later became a venue.", sourceIds: ["wikipedia"] },
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

  it.each([
    [{ startYear: 0, precision: "exact", granularity: "year" }, "Year zero"],
    [{ startYear: 400, endYear: 301, precision: "exact", granularity: "century" }, "End year"],
    [{ startYear: 301, precision: "exact", granularity: "century" }, "expected number"],
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

  it("rejects duplicate Insight IDs and unknown Sources", () => {
    const duplicate = validStoryContent();
    const insight = { id: "same-id", description: "An insight.", sourceIds: ["wikipedia"] };
    duplicate.topics.design.push(insight);
    duplicate.topics.art.push(insight);
    expect(() => parseStoryContent(duplicate, ["wikipedia"])).toThrow("duplicated");

    const danglingSource = validStoryContent();
    danglingSource.relatedPeople.push({ name: "Unknown", sourceIds: ["unknown"] });
    expect(() => parseStoryContent(danglingSource, ["wikipedia"])).toThrow("unknown Source");
  });
});
