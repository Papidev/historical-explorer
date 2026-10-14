import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoryContent } from "./StoryContent";

describe("StoryContent", () => {
  it("renders metadata and chronological History before the remaining topics", () => {
    const html = renderToStaticMarkup(
      <StoryContent
        period="Roman Republic"
        content={{
          introduction: "Introduction: C++ and <script> stay text. C++ appears again.",
          introductionEmphasis: ["C++ and <script>", "C++", "missing phrase"],
          topics: {
            history: [
              { description: "Undated history", emphasis: ["Undated"] },
              {
                description: "Medieval history",
                time: { startYear: 1000, precision: "approximate", granularity: "century" },
              },
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
            design: [{ description: "Design insight", emphasis: ["Design"] }],
            art: [{ description: "Art insight" }],
          },
          relatedPeople: [{ name: "Related Person", personId: "related-person" }],
        }}
      />,
    );

    expect(html).toContain("Roman Republic");
    expect(html).toContain("c. 6th–5th century BC");
    expect(html).toContain("c. 10th century AD");
    expect(html).not.toContain("1000 AD");
    expect(html.indexOf("Ancient history")).toBeLessThan(html.indexOf("Modern history"));
    expect(html.indexOf("Modern history")).toBeLessThan(html.indexOf("Undated"));
    expect(html.indexOf("Undated")).toBeLessThan(html.indexOf("Design"));
    expect(html.indexOf("Design")).toBeLessThan(html.indexOf("Art insight"));
    expect(html.indexOf("Art insight")).toBeLessThan(html.indexOf("Related Person"));
    expect(html).toContain(
      '<strong class="font-semibold text-amber-900">C++ and &lt;script&gt;</strong>',
    );
    expect(html).toContain("C++ appears again.");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("missing phrase");
    expect(html).toContain('<strong class="font-semibold text-amber-900">Undated</strong>');
    expect(html).toContain('<strong class="font-semibold text-amber-900">Design</strong>');
    expect(html).toContain("Art insight</li>");
  });
});
