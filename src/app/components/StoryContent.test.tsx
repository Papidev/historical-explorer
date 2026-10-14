import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoryContent } from "./StoryContent";

describe("StoryContent", () => {
  it("renders Markdown throughout the Story without nesting paragraphs", () => {
    const html = renderToStaticMarkup(
      <StoryContent
        content={{
          textFormat: "markdown",
          introduction:
            "The temple stands beside the river.\n\nIts **bronze doors** survive, beside *ancient columns*.\n\n[Learn more](https://example.com/temple)",
          topics: {
            history: [
              { description: "The **restoration** saved the building.\n\nIt reopened later." },
            ],
            design: [{ description: "Look for:\n\n- **Original hinges**\n- Reused columns" }],
            art: [{ description: "## Details\n\n1. *Frescoes*\n2. Mosaics" }],
          },
          relatedPeople: [],
        }}
      />,
    );

    expect(html).toContain("<p>The temple stands beside the river.</p>");
    expect(html).toContain('<strong class="font-semibold text-amber-900">bronze doors</strong>');
    expect(html).toContain("<em>ancient columns</em>");
    expect(html).toContain('href="https://example.com/temple"');
    expect(html).toContain('<strong class="font-semibold text-amber-900">restoration</strong>');
    expect(html).toContain("<p>It reopened later.</p>");
    expect(html).toContain('<ul class="list-disc space-y-2 pl-5">');
    expect(html).toContain('<ol class="list-decimal space-y-2 pl-5">');
    expect(html).toContain('<h4 class="text-lg font-semibold text-zinc-950">Details</h4>');
    expect(html).not.toContain("<p><div");
    expect(html).not.toContain("**");
  });

  it("does not execute HTML or render unsafe Markdown links and embedded images", () => {
    const html = renderToStaticMarkup(
      <StoryContent
        content={{
          textFormat: "markdown",
          introduction:
            '<script>alert("test")</script>\n\n[Unsafe](javascript:alert%281%29)\n\n![Remote image](https://example.com/image.jpg)',
          topics: { history: [], design: [], art: [] },
          relatedPeople: [],
        }}
      />,
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("<img");
    expect(html).toContain("Unsafe</a>");
  });

  it.each(["\n\n", "\r\n\r\n", "\n \n\n"])(
    "separates introduction paragraphs while preserving text and emphasis (%j)",
    (separator) => {
      const html = renderToStaticMarkup(
        <StoryContent
          content={{
            introduction: `  The temple stands beside the river.${separator}Its bronze doors survive.\nLook for the original hinges.  `,
            introductionEmphasis: ["bronze doors"],
            topics: { history: [], design: [], art: [] },
            relatedPeople: [],
          }}
        />,
      );

      expect(html).toContain(
        '<p class="whitespace-pre-line">The temple stands beside the river.</p>',
      );
      expect(html).toContain(
        '<p class="whitespace-pre-line">Its <strong class="font-semibold text-amber-900">bronze doors</strong> survive.\nLook for the original hinges.</p>',
      );
      expect(html.match(/<p\b/g)).toHaveLength(2);
    },
  );

  it("renders metadata and chronological History before the remaining topics", () => {
    const html = renderToStaticMarkup(
      <StoryContent
        period="Roman Republic"
        content={{
          introduction:
            "Introduction: C++ and <script> stay text. C++ appears again. **Literal stars** stay plain.",
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
    expect(html).toContain("**Literal stars** stay plain.");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("missing phrase");
    expect(html).toContain('<strong class="font-semibold text-amber-900">Undated</strong>');
    expect(html).toContain('<strong class="font-semibold text-amber-900">Design</strong>');
    expect(html).toContain("Art insight</li>");
  });
});
