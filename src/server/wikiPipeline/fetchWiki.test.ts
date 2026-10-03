import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { resolvePageForPoi } from "./resolve";
import { buildWikipediaPageUrl } from "./io";
import { wikiTextToPlainText } from "./wikiText";
import { fetchWikiSnapshot } from "./fetchWiki";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Wikipedia source acquisition", () => {
  it.each([
    "unique alias",
    "unrelated",
    "ambiguous",
    "same entity in both languages",
    "distant",
    "wrong type",
  ])("handles geographic fallback with %s candidates", async (scenario) => {
    const requests: string[] = [];
    server.use(
      http.get(/https:\/\/(en|it)\.wikipedia\.org\/w\/api\.php/, ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.searchParams.get("generator") ?? url.searchParams.get("list") ?? "title");
        if (url.searchParams.get("generator") !== "geosearch") {
          return HttpResponse.json({
            query: { pages: [{ title: "Local name", missing: true }], search: [] },
          });
        }
        expect(url.searchParams.get("ggscoord")).toBe("41.8|12.5");
        expect(url.searchParams.get("ggsradius")).toBe("1000");
        expect(url.searchParams.get("ggsprimary")).toBe("primary");
        if (url.hostname === "it.wikipedia.org" && scenario !== "same entity in both languages")
          return HttpResponse.json({ query: { pages: [] } });
        return HttpResponse.json({
          query: {
            pages: (scenario === "ambiguous" ? ["Q100", "Q200"] : ["Q100"]).map((id) => ({
              title:
                url.hostname === "it.wikipedia.org" ? "Nome canonico" : `Canonical place ${id}`,
              pageprops: { wikibase_item: id },
              coordinates: [
                {
                  lat: scenario === "distant" ? 45 : 41.8001,
                  lon: 12.5,
                  primary: true,
                  globe: "earth",
                  type: scenario === "wrong type" ? "city" : "landmark",
                },
              ],
            })),
          },
        });
      }),
      http.get("https://www.wikidata.org/w/api.php", ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get("props")).toBe("labels|aliases");
        return HttpResponse.json({
          entities: Object.fromEntries(
            (url.searchParams.get("ids") ?? "").split("|").map((id) => [
              id,
              {
                labels: { en: { value: "Canonical place" } },
                aliases: {
                  it: [{ value: scenario === "unrelated" ? "Unrelated place" : "Local name" }],
                },
              },
            ]),
          ),
        });
      }),
    );
    const resolution = resolvePageForPoi({
      id: "local-place",
      name: "Local name",
      city: "rome",
      coordinates: { lat: 41.8, lng: 12.5 },
      sourceHints: {},
    });
    if (scenario === "unique alias" || scenario === "same entity in both languages") {
      await expect(resolution).resolves.toMatchObject({
        method: "coordinates_enwiki",
        selected: { title: "Canonical place Q100", language: "en" },
      });
    } else {
      await expect(resolution).rejects.toThrow("No unambiguous English or Italian Wikipedia page");
    }
    expect(requests.slice(0, 4)).toEqual(["title", "search", "title", "search"]);
    expect(requests.slice(4)).toEqual(["geosearch", "geosearch"]);
  });

  it.each([
    "no coordinates",
    "distant",
    "non-Earth",
    "secondary",
    "non-primary",
    "broad entity",
    "unknown type",
  ])(
    "rejects the Aereo name collision with %s instead of selecting an unrelated source",
    async (scenario) => {
      server.use(
        http.get(/https:\/\/(en|it)\.wikipedia\.org\/w\/api\.php/, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get("list") === "search") {
            return HttpResponse.json({ query: { search: [] } });
          }
          return HttpResponse.json({
            query: {
              pages: [
                {
                  title: "Aereo",
                  ...(url.hostname === "it.wikipedia.org"
                    ? { missing: true }
                    : {
                        pageprops: { wikibase_item: "Q4687964" },
                        coordinates:
                          scenario === "no coordinates"
                            ? []
                            : [
                                {
                                  lat: scenario === "distant" ? 40.7 : 41.7417522,
                                  lon: scenario === "distant" ? -74 : 12.2892098,
                                  ...(scenario === "secondary"
                                    ? {}
                                    : { primary: scenario !== "non-primary" }),
                                  globe: scenario === "non-Earth" ? "moon" : "earth",
                                  type:
                                    scenario === "unknown type"
                                      ? undefined
                                      : scenario === "broad entity"
                                        ? "city"
                                        : "landmark",
                                },
                              ],
                      }),
                },
              ],
            },
          });
        }),
      );
      await expect(
        resolvePageForPoi({
          id: "aereo",
          name: "Aereo",
          city: "rome",
          coordinates: { lat: 41.7417522, lng: 12.2892098 },
          sourceHints: {},
        }),
      ).rejects.toThrow("No unambiguous English or Italian Wikipedia page");
    },
  );

  it("falls back to a nearby Italian place after rejecting an unrelated English namesake", async () => {
    server.use(
      http.get(/https:\/\/(en|it)\.wikipedia\.org\/w\/api\.php/, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("list") === "search")
          return HttpResponse.json({ query: { search: [] } });
        expect(url.searchParams.get("coprimary")).toBe("primary");
        expect(url.searchParams.get("coprop")).toBe("type|globe");
        return HttpResponse.json({
          query: {
            pages: [
              {
                title: "Aereo",
                coordinates:
                  url.hostname === "en.wikipedia.org"
                    ? []
                    : [
                        {
                          lat: 41.7418,
                          lon: 12.2892,
                          primary: true,
                          globe: "earth",
                          type: "landmark",
                        },
                      ],
              },
            ],
          },
        });
      }),
    );
    await expect(
      resolvePageForPoi({
        id: "aereo",
        name: "Aereo",
        city: "rome",
        coordinates: { lat: 41.7417522, lng: 12.2892098 },
        sourceHints: {},
      }),
    ).resolves.toMatchObject({
      method: "name_itwiki",
      selected: { title: "Aereo", language: "it" },
    });
  });

  it.each(["wikipedia tag", "Wikidata sitelink"])(
    "prefers an explicit Italian %s over an English namesake",
    async (scenario) => {
      server.use(
        http.get("https://www.wikidata.org/w/api.php", () =>
          HttpResponse.json({
            entities: { Q100: { sitelinks: { itwiki: { title: "Monumento dell'aereo" } } } },
          }),
        ),
        http.get("https://it.wikipedia.org/w/api.php", ({ request }) => {
          expect(new URL(request.url).searchParams.get("titles")).toBe("Monumento dell'aereo");
          return HttpResponse.json({ query: { pages: [{ title: "Monumento dell'aereo" }] } });
        }),
      );
      await expect(
        resolvePageForPoi({
          id: "aereo",
          name: "Aereo",
          city: "rome",
          coordinates: { lat: 41.7417522, lng: 12.2892098 },
          sourceHints:
            scenario === "wikipedia tag"
              ? { wikipedia: "it:Monumento dell'aereo" }
              : { wikidata: "Q100" },
        }),
      ).resolves.toMatchObject({
        method: scenario === "wikipedia tag" ? "wikipedia_tag_it" : "wikidata_itwiki",
        selected: { title: "Monumento dell'aereo", language: "it" },
      });
    },
  );

  it.each(["english redirect", "italian to english", "italian only"])(
    "searches by the original POI name and acquires the correct source for %s",
    async (scenario) => {
      const requests: string[] = [];
      const name = "Acquedotto dei Sette Bassi";
      const englishTitle = "Sette Bassi aqueduct";
      server.use(
        http.get(/https:\/\/(en|it)\.wikipedia\.org\/w\/api\.php/, ({ request }) => {
          const url = new URL(request.url);
          requests.push(url.hostname);
          if (url.searchParams.get("list") === "search") {
            expect(url.searchParams.get("srsearch")).toBe(name);
            return HttpResponse.json({ query: { search: [] } });
          }
          if (url.searchParams.get("prop")?.startsWith("pageprops|langlinks")) {
            expect(url.searchParams.get("titles")).toBe(name);
            return HttpResponse.json({
              query: {
                pages: [
                  url.hostname === "en.wikipedia.org"
                    ? scenario === "english redirect"
                      ? {
                          title: englishTitle,
                          coordinates: [
                            {
                              lat: 41.8005,
                              lon: 12.5,
                              primary: "",
                              globe: "earth",
                              type: "landmark",
                            },
                          ],
                        }
                      : { title: name, missing: true }
                    : {
                        title: name,
                        coordinates: [
                          { lat: 41.8, lon: 12.5, primary: "", globe: "earth", type: "landmark" },
                        ],
                        ...(scenario === "italian to english"
                          ? { langlinks: [{ lang: "en", title: englishTitle }] }
                          : {}),
                      },
                ],
              },
            });
          }
          expect(url.searchParams.get("titles")).toBe(
            scenario === "italian only" ? name : englishTitle,
          );
          return HttpResponse.json({
            query: {
              pages: [
                {
                  title: url.searchParams.get("titles"),
                  revisions: [
                    {
                      slots: {
                        main: {
                          content:
                            scenario === "italian only"
                              ? "Un acquedotto romano, legato a [[Sette Bassi]].\n\n==Note==\nReferences to omit.\n\n==Collegamenti esterni==\nExternal links to omit."
                              : "A Roman aqueduct.",
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
      const page = await resolvePageForPoi({
        id: "sette-bassi",
        name,
        city: "Rome",
        coordinates: { lat: 41.8, lng: 12.5 },
        sourceHints: {},
      });
      const snapshot = await fetchWikiSnapshot(page.selected.title, page.selected.language);
      const language = scenario === "italian only" ? "it" : "en";
      expect(requests.at(-1)).toBe(`${language}.wikipedia.org`);
      expect(buildWikipediaPageUrl(snapshot.title, page.selected.language)).toContain(
        `https://${language}.wikipedia.org/`,
      );
      expect(wikiTextToPlainText(snapshot.fullText)).toContain(
        language === "it" ? "Un acquedotto romano" : "A Roman aqueduct",
      );
      if (language === "it") {
        expect(snapshot.links).toContainEqual({
          label: "Sette Bassi",
          title: "Sette Bassi",
          language: "it",
        });
        expect(wikiTextToPlainText(snapshot.fullText)).not.toContain("to omit");
      }
    },
  );

  it.each(["redirect", "unrelated", "ambiguous", "disambiguation"])(
    "handles %s results when an exact name page does not exist",
    async (scenario) => {
      server.use(
        http.get(/https:\/\/(en|it)\.wikipedia\.org\/w\/api\.php/, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get("list") === "search") {
            return HttpResponse.json({
              query: {
                search:
                  url.hostname === "it.wikipedia.org"
                    ? []
                    : scenario === "redirect"
                      ? [{ title: "Roman aqueduct", redirecttitle: "Acquedotto dei Sette Bassi" }]
                      : scenario === "ambiguous"
                        ? [
                            { title: "Acquedotto dei Sette Bassi (Rome)" },
                            { title: "Acquedotto dei Sette Bassi (Other city)" },
                          ]
                        : [
                            {
                              title:
                                scenario === "unrelated"
                                  ? "Another aqueduct"
                                  : "Acquedotto dei Sette Bassi (Rome)",
                            },
                          ],
              },
            });
          }
          const title = url.searchParams.get("titles");
          return HttpResponse.json({
            query: {
              pages: [
                {
                  title,
                  coordinates: [
                    { lat: 41.8, lon: 12.5, primary: "", globe: "earth", type: "landmark" },
                  ],
                  ...(title === "Acquedotto dei Sette Bassi" ? { missing: true } : {}),
                  ...(scenario === "disambiguation" ? { pageprops: { disambiguation: "" } } : {}),
                },
              ],
            },
          });
        }),
      );
      const resolution = resolvePageForPoi({
        id: "sette-bassi",
        name: "Acquedotto dei Sette Bassi",
        city: "Rome",
        coordinates: { lat: 41.8, lng: 12.5 },
        sourceHints: {},
      });
      if (scenario === "redirect")
        await expect(resolution).resolves.toMatchObject({ selected: { title: "Roman aqueduct" } });
      else
        await expect(resolution).rejects.toThrow(
          "No unambiguous English or Italian Wikipedia page",
        );
    },
  );

  it("prefers an existing English Wikidata link without searching by name", async () => {
    server.use(
      http.get("https://www.wikidata.org/w/api.php", ({ request }) => {
        expect(new URL(request.url).searchParams.get("ids")).toBe("Q100");
        return HttpResponse.json({
          entities: {
            Q100: {
              sitelinks: { enwiki: { title: "Roman aqueduct" }, itwiki: { title: "Acquedotto" } },
            },
          },
        });
      }),
    );
    await expect(
      resolvePageForPoi({
        id: "aqueduct",
        name: "Acquedotto",
        city: "Rome",
        coordinates: { lat: 41.8, lng: 12.5 },
        sourceHints: { wikidata: "Q100" },
      }),
    ).resolves.toMatchObject({ method: "wikidata_enwiki", selected: { title: "Roman aqueduct" } });
  });

  it("recognizes Wikipedia disambiguation metadata even when its value is empty", async () => {
    server.use(
      http.get("https://en.wikipedia.org/w/api.php", () =>
        HttpResponse.json({
          query: {
            pages: [
              {
                title: "John Smith",
                pageprops: { wikibase_item: "Q100", disambiguation: "" },
                revisions: [
                  { slots: { main: { content: "John Smith may refer to several people." } } },
                ],
              },
            ],
          },
        }),
      ),
    );
    await expect(fetchWikiSnapshot("John Smith")).resolves.toMatchObject({
      isDisambiguation: true,
    });
  });
  it("waits for Retry-After before retrying a rate-limited request", async () => {
    let requests = 0;
    server.use(
      http.get("https://en.wikipedia.org/w/api.php", () => {
        requests += 1;
        if (requests === 1) {
          return new HttpResponse(null, { status: 429, headers: { "Retry-After": "1" } });
        }
        return HttpResponse.json({
          query: {
            pages: [
              {
                title: "Hercules",
                revisions: [{ slots: { main: { content: "'''Hercules''' was a hero." } } }],
              },
            ],
          },
        });
      }),
    );

    const startedAt = Date.now();
    await expect(fetchWikiSnapshot("Hercules")).resolves.toMatchObject({ title: "Hercules" });
    expect(requests).toBe(2);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(900);
  });
});
