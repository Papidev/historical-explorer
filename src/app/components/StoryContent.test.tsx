import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoryContent } from "./StoryContent";

describe("StoryContent", () => {
  it("renders metadata and chronological History before the remaining topics", () => {
    const html = renderToStaticMarkup(
      <StoryContent
        period="Roman Republic"
        address="5 Arco della Pace, Rome"
        content={{
          introduction: "Introduction",
          topics: {
            history: [
              { description: "Undated history" },
              {
                description: "Modern history",
                time: {
                  startYear: 1500,
                  precision: "approximate",
                  granularity: "year",
                },
              },
              {
                description: "Ancient history",
                time: {
                  startYear: -600,
                  endYear: -401,
                  precision: "approximate",
                  granularity: "century",
                },
              },
            ],
            design: [{ description: "Design insight" }],
            art: [{ description: "Art insight" }],
          },
          relatedPeople: [{ name: "Related Person", relationship: "Relationship" }],
        }}
      />,
    );

    expect(html).toContain("Roman Republic");
    expect(html).toContain("5 Arco della Pace, Rome");
    expect(html).toContain("c. 6th–5th century BC");
    expect(html.indexOf("Ancient history")).toBeLessThan(html.indexOf("Modern history"));
    expect(html.indexOf("Modern history")).toBeLessThan(html.indexOf("Undated history"));
    expect(html.indexOf("Undated history")).toBeLessThan(html.indexOf("Design insight"));
    expect(html.indexOf("Design insight")).toBeLessThan(html.indexOf("Art insight"));
    expect(html.indexOf("Art insight")).toBeLessThan(html.indexOf("Related Person"));
  });
});
