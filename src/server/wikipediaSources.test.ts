import { expect, it } from "vitest";
import { toWikipediaSources } from "./wikipediaSources";

it("retains known article metadata without leaking source text or duplicating links", () => {
  const source = {
    title: "Forum Boarium",
    url: "https://en.wikipedia.org/wiki/Forum_Boarium",
    content: "Internal Source text",
  };
  expect(toWikipediaSources([source, source])).toEqual([{ title: source.title, url: source.url }]);
});

it("does not expose unsafe URLs or links that are not Wikipedia articles", () => {
  expect(
    toWikipediaSources(
      [
        "javascript:alert(1)",
        "not a url",
        "https://wikipedia.org.attacker.example/wiki/Forum_Boarium",
        "https://en.wikipedia.org/",
        "https://en.wikipedia.org/wiki/",
        "http://en.wikipedia.org/wiki/Forum_Boarium",
      ].map((url) => ({ title: "Forum Boarium", url })),
    ),
  ).toEqual([]);
});
