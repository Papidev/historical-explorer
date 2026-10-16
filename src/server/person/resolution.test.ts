import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createPeople } from ".";
import { createFilesystemPersonRepository } from "./filesystemRepository";

const server = setupServer();
const directories: string[] = [];

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
afterAll(() => server.close());

describe("Person identity resolution from Wikipedia and Wikidata", () => {
  it.each(["tomb", "tomb only", "person", "unknown", "deprecated human", "human and other type"])(
    "checks a second candidate classified as %s",
    async (scenario) => {
      const directory = mkdtempSync(path.join(tmpdir(), "person-resolution-"));
      directories.push(directory);
      const repository = createFilesystemPersonRepository(directory);
      const generatedIds: string[] = [];
      server.use(
        http.get("https://en.wikipedia.org/w/api.php", ({ request }) => {
          const title = new URL(request.url).searchParams.get("titles")!;
          return HttpResponse.json({
            query: {
              pages: [
                {
                  title,
                  pageprops: { wikibase_item: title === "Pope Julius II" ? "Q1" : "Q2" },
                  revisions: [
                    { slots: { main: { content: `'''${title}''' is sourced content.` } } },
                  ],
                },
              ],
            },
          });
        }),
        http.get("https://www.wikidata.org/w/api.php", ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get("props")).toBe("claims");
          const id = url.searchParams.get("ids")!;
          return HttpResponse.json({
            entities: {
              [id]: {
                claims: {
                  P31:
                    id === "Q1" || scenario === "person"
                      ? [{ mainsnak: { datavalue: { value: { id: "Q5" } } } }]
                      : scenario === "unknown"
                        ? []
                        : [
                            { mainsnak: { datavalue: { value: { id: "Q381885" } } } },
                            ...(scenario === "deprecated human" ||
                            scenario === "human and other type"
                              ? [
                                  {
                                    rank: scenario === "deprecated human" ? "deprecated" : "normal",
                                    mainsnak: { datavalue: { value: { id: "Q5" } } },
                                  },
                                ]
                              : []),
                          ],
                },
              },
            },
          });
        }),
      );
      const people = createPeople({
        repository,
        acquireSources: async ({ initialSource }) => ({ sources: [initialSource!], warnings: [] }),
        generateContent: async ({ wikidataId }) => {
          generatedIds.push(wikidataId);
          return {
            description: [
              { text: "First paragraph.", sourceIds: ["wikipedia"] },
              { text: "Second paragraph.", sourceIds: ["wikipedia"] },
            ],
            curiosities: [],
          };
        },
        fetchImageCandidates: async () => [],
      });
      const result = await people.resolveAndGenerateMissing({
        relatedPeople: [{ name: "Pope Julius II", sourceIds: ["wikipedia"] }],
        storySources: [
          {
            id: "wikipedia",
            kind: "wikipedia",
            title: "Saint Peter in Chains",
            url: "https://en.wikipedia.org/wiki/Saint_Peter_in_Chains",
            content: "The tomb of Pope Julius II.",
            links: [
              { label: "Pope Julius II", title: "Tomb of Pope Julius II" },
              ...(scenario === "tomb only"
                ? []
                : [{ label: "Pope Julius II", title: "Pope Julius II" }]),
            ],
          },
        ],
        ai: { mode: "local", model: "test-model" },
      });
      if (scenario === "tomb" || scenario === "deprecated human") {
        expect(result.failures).toEqual([]);
        expect(generatedIds).toEqual(["Q1"]);
        expect(repository.get(result.relatedPeople[0].personId!)?.wikipediaTitle).toBe(
          "Pope Julius II",
        );
      } else if (scenario === "tomb only") {
        expect(result.relatedPeople).toEqual([]);
        expect(result.failures).toEqual([]);
        expect(generatedIds).toEqual([]);
        expect(repository.list()).toEqual([]);
      } else {
        expect(result.failures).toHaveLength(1);
        expect(result.failures[0].message).toContain("identity is ambiguous");
        expect(result.failures[0].message).toContain(
          "Tomb of Pope Julius II (https://en.wikipedia.org/wiki/Tomb_of_Pope_Julius_II)",
        );
        expect(result.failures[0].message).toContain(
          "Pope Julius II (https://en.wikipedia.org/wiki/Pope_Julius_II)",
        );
        expect(generatedIds).toEqual([]);
        expect(repository.list()).toEqual([]);
      }
    },
  );
});
