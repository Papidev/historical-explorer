import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { acquireWikipediaSources } from "./acquireWikipediaSources";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const entities = {
  Q100: {
    claims: { P17: [{ mainsnak: { datavalue: { value: { id: "Q38" } } } }] },
    sitelinks: { enwiki: { title: "Monument" }, itwiki: { title: "Monumento" } },
  },
  Q200: {
    claims: { P27: [{ mainsnak: { datavalue: { value: { id: "Q142" } } } }] },
    sitelinks: {
      enwiki: { title: "Artist" },
      frwiki: { title: "Artiste" },
      itwiki: { title: "Artista" },
    },
  },
  Q38: { claims: { P37: [{ mainsnak: { datavalue: { value: { id: "Q652" } } } }] } },
  Q142: { claims: { P37: [{ mainsnak: { datavalue: { value: { id: "Q150" } } } }] } },
  Q652: { claims: { P424: [{ mainsnak: { datavalue: { value: "it" } } }] } },
  Q150: { claims: { P424: [{ mainsnak: { datavalue: { value: "fr" } } }] } },
};

describe("Wikipedia editions", () => {
  it("excludes editions outside the allowed list, including a previously saved primary edition", async () => {
    const requestedLanguages: string[] = [];
    server.use(
      http.get("https://www.wikidata.org/w/api.php", ({ request }) => {
        const ids = new URL(request.url).searchParams.get("ids")!.split("|");
        return HttpResponse.json({
          entities: Object.fromEntries(
            ids.map((id) => [
              id,
              id === "Q142"
                ? {
                    claims: {
                      P37: [
                        { mainsnak: { datavalue: { value: { id: "Q150" } } } },
                        { mainsnak: { datavalue: { value: { id: "Q7411" } } } },
                      ],
                    },
                  }
                : id === "Q7411"
                  ? { claims: { P424: [{ mainsnak: { datavalue: { value: "nl" } } }] } }
                  : entities[id as keyof typeof entities],
            ]),
          ),
        });
      }),
      http.get(/https:\/\/(en|fr|nl)\.wikipedia\.org\/w\/api\.php/, ({ request }) => {
        const url = new URL(request.url);
        requestedLanguages.push(url.hostname.split(".")[0]);
        return HttpResponse.json({
          query: {
            pages: [
              {
                title: url.searchParams.get("titles"),
                pageprops: { wikibase_item: "Q200" },
                revisions: [{ slots: { main: { content: "Supported artist content." } } }],
              },
            ],
          },
        });
      }),
    );
    const result = await acquireWikipediaSources({
      wikidataId: "Q200",
      countryProperty: "P27",
      initialSource: {
        id: "wikipedia",
        kind: "wikipedia",
        title: "Kunstenaar",
        url: "https://nl.wikipedia.org/wiki/Kunstenaar",
        content: "Previously saved content.",
      },
    });
    expect(requestedLanguages).toEqual(["en", "fr"]);
    expect(result.sources.map(({ id }) => id)).toEqual(["wikipedia", "wikipedia-fr"]);
    expect(result.sources[0].url).toBe("https://en.wikipedia.org/wiki/Artist");
    expect(result.warnings).toEqual([]);
  });

  it.each(["both", "missing English", "unavailable Italian", "wrong entity"])(
    "acquires available editions of a Rome POI (%s)",
    async (scenario) => {
      server.use(
        http.get("https://www.wikidata.org/w/api.php", ({ request }) => {
          const ids = new URL(request.url).searchParams.get("ids")!.split("|");
          return HttpResponse.json({
            entities: Object.fromEntries(
              ids.map((id) => [id, entities[id as keyof typeof entities]]),
            ),
          });
        }),
        http.get(/https:\/\/(en|it)\.wikipedia\.org\/w\/api\.php/, ({ request }) => {
          const url = new URL(request.url);
          const italian = url.hostname.startsWith("it.");
          if (scenario === "unavailable Italian" && italian)
            return new HttpResponse(null, { status: 404 });
          if (scenario === "missing English" && !italian)
            return HttpResponse.json({ query: { pages: [{ missing: true }] } });
          return HttpResponse.json({
            query: {
              pages: [
                {
                  title: url.searchParams.get("titles"),
                  pageprops: {
                    wikibase_item: scenario === "wrong entity" && italian ? "Q999" : "Q100",
                  },
                  revisions: [
                    {
                      slots: {
                        main: {
                          content: italian
                            ? "Nel 1929 [[Benito Mussolini]] si oppose alla rimozione."
                            : "The monument was unveiled in 1889.",
                        },
                      },
                    },
                  ],
                },
              ],
            },
          });
        }),
      );
      const result = await acquireWikipediaSources({ wikidataId: "Q100" });
      expect(result.sources.map(({ url }) => new URL(url).hostname)).toEqual(
        scenario === "both"
          ? ["en.wikipedia.org", "it.wikipedia.org"]
          : scenario === "missing English"
            ? ["it.wikipedia.org"]
            : ["en.wikipedia.org"],
      );
      if (scenario === "both") {
        expect(result.warnings).toEqual([]);
        expect(result.sources[1]).toMatchObject({
          id: "wikipedia-it",
          content: expect.stringContaining("1929"),
          links: [{ title: "Benito Mussolini", label: "Benito Mussolini", language: "it" }],
        });
      } else expect(result.warnings.length).toBeGreaterThan(0);
    },
  );

  it("combines a Person's country with the POI country and deduplicates English", async () => {
    const requests: string[] = [];
    server.use(
      http.get("https://www.wikidata.org/w/api.php", ({ request }) => {
        const ids = new URL(request.url).searchParams.get("ids")!.split("|");
        return HttpResponse.json({
          entities: Object.fromEntries(
            ids.map((id) => [
              id,
              id === "Q38"
                ? {
                    claims: {
                      P37: [
                        { mainsnak: { datavalue: { value: { id: "Q652" } } } },
                        { mainsnak: { datavalue: { value: { id: "Q1860" } } } },
                      ],
                    },
                  }
                : id === "Q1860"
                  ? { claims: { P424: [{ mainsnak: { datavalue: { value: "en" } } }] } }
                  : entities[id as keyof typeof entities],
            ]),
          ),
        });
      }),
      http.get(/https:\/\/(en|it|fr)\.wikipedia\.org\/w\/api\.php/, ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.hostname);
        return HttpResponse.json({
          query: {
            pages: [
              {
                title: url.searchParams.get("titles"),
                pageprops: { wikibase_item: "Q200" },
                revisions: [
                  { slots: { main: { content: "An artist supported by this edition." } } },
                ],
              },
            ],
          },
        });
      }),
    );
    const result = await acquireWikipediaSources({
      wikidataId: "Q200",
      countryProperty: "P27",
      contextWikidataIds: ["Q100"],
    });
    expect(new Set(requests)).toEqual(
      new Set(["en.wikipedia.org", "it.wikipedia.org", "fr.wikipedia.org"]),
    );
    expect(result.sources).toHaveLength(3);
    expect(result.warnings).toEqual([]);
  });

  it("fails when no edition is usable", async () => {
    server.use(
      http.get("https://www.wikidata.org/w/api.php", () => HttpResponse.json({ entities: {} })),
    );
    await expect(acquireWikipediaSources({ wikidataId: "Q100" })).rejects.toThrow(
      "No usable Wikipedia sources",
    );
  });
});
