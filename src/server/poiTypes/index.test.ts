import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { PoiInput } from "@/server/wikiPipeline/types";
import { createPoiTypes } from ".";

const server = setupServer();
const pointOfInterest: PoiInput = {
  id: "example-church",
  name: "Example Church",
  city: "Rome",
  coordinates: { lat: 41.9, lng: 12.5 },
  sourceHints: { wikidata: "Q100" },
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("POI types", () => {
  const directories: string[] = [];
  afterAll(() =>
    directories.forEach((directory) => rmSync(directory, { recursive: true, force: true })),
  );

  const createModule = (poi = pointOfInterest) => {
    const directory = mkdtempSync(path.join(tmpdir(), "poi-types-"));
    directories.push(directory);
    return createPoiTypes({
      directory,
      findPointOfInterest: (poiId) => (poiId === poi.id ? poi : undefined),
    });
  };

  it("saves multiple readable types and replaces them on refresh", async () => {
    const poiTypes = createModule();
    let typeIds = ["Q16970", "Q33506"];
    server.use(
      http.get("https://www.wikidata.org/w/api.php", ({ request }) => {
        const ids = new URL(request.url).searchParams.get("ids");
        if (ids === "Q100") {
          return HttpResponse.json({
            entities: {
              Q100: {
                claims: {
                  P31: typeIds.map((id) => ({ mainsnak: { datavalue: { value: { id } } } })),
                },
              },
            },
          });
        }
        return HttpResponse.json({
          entities: Object.fromEntries(
            (ids ?? "")
              .split("|")
              .map((id) => [
                id,
                { labels: { en: { value: id === "Q16970" ? "church building" : "museum" } } },
              ]),
          ),
        });
      }),
    );

    await expect(poiTypes.refresh(pointOfInterest.id)).resolves.toEqual({
      types: [
        { id: "Q16970", label: "church building" },
        { id: "Q33506", label: "museum" },
      ],
    });
    typeIds = ["Q33506"];
    await expect(poiTypes.refresh(pointOfInterest.id)).resolves.toEqual({
      types: [{ id: "Q33506", label: "museum" }],
    });
    expect(poiTypes.get(pointOfInterest.id)?.types).toEqual([{ id: "Q33506", label: "museum" }]);
  });

  it("stores an empty result when Wikidata has no types", async () => {
    const poiTypes = createModule();
    server.use(
      http.get("https://www.wikidata.org/w/api.php", () =>
        HttpResponse.json({ entities: { Q100: { claims: {} } } }),
      ),
    );

    await expect(poiTypes.refresh(pointOfInterest.id)).resolves.toEqual({ types: [] });
    expect(poiTypes.get(pointOfInterest.id)).toEqual({ types: [] });
  });

  it("reports a missing Wikidata ID without requesting data", async () => {
    const poiTypes = createModule({ ...pointOfInterest, sourceHints: {} });

    await expect(poiTypes.refresh(pointOfInterest.id)).resolves.toEqual({
      types: [],
      error: "No Wikidata ID.",
    });
    expect(poiTypes.get(pointOfInterest.id)).toBeUndefined();
  });

  it("keeps saved types when Wikidata fails", async () => {
    const poiTypes = createModule();
    server.use(
      http.get("https://www.wikidata.org/w/api.php", ({ request }) =>
        new URL(request.url).searchParams.get("ids") === "Q100"
          ? HttpResponse.json({
              entities: {
                Q100: {
                  claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q16970" } } } }] },
                },
              },
            })
          : HttpResponse.json({
              entities: { Q16970: { labels: { en: { value: "church building" } } } },
            }),
      ),
    );
    await poiTypes.refresh(pointOfInterest.id);
    server.use(
      http.get("https://www.wikidata.org/w/api.php", () => new HttpResponse(null, { status: 503 })),
    );

    const result = await poiTypes.refresh(pointOfInterest.id);
    expect(result.types).toEqual([{ id: "Q16970", label: "church building" }]);
    expect(result.error).toContain("503");
    expect(poiTypes.get(pointOfInterest.id)).toEqual(result);
  });
});
