import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { PoiInput } from "@/server/wikiPipeline/types";
import { fetchMainImageCandidates } from "./mainImageCandidates";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Main Image Candidates", () => {
  it("discovers the page image from the Italian source edition", async () => {
    server.use(
      http.get("https://it.wikipedia.org/w/api.php", ({ request }) => {
        expect(new URL(request.url).searchParams.get("titles")).toBe("Acquedotto dei Sette Bassi");
        return HttpResponse.json({ query: { pages: [{ pageimage: "Aqueduct.jpg" }] } });
      }),
      http.get("https://commons.wikimedia.org/w/api.php", () =>
        HttpResponse.json({
          query: {
            pages: [
              {
                imageinfo: [
                  {
                    url: "https://upload.wikimedia.org/original.jpg",
                    thumburl: "https://upload.wikimedia.org/thumb.jpg",
                    extmetadata: {
                      LicenseShortName: { value: "CC BY-SA 4.0" },
                      Artist: { value: "Photographer" },
                    },
                  },
                ],
              },
            ],
          },
        }),
      ),
    );
    await expect(
      fetchMainImageCandidates(
        {
          id: "sette-bassi",
          name: "Acquedotto dei Sette Bassi",
          city: "Rome",
          coordinates: { lat: 41.8, lng: 12.5 },
          sourceHints: {},
        },
        "Acquedotto dei Sette Bassi",
        "it",
      ),
    ).resolves.toMatchObject([
      { commonsFileName: "Aqueduct.jpg", discoveredVia: "wikipedia-page-image" },
    ]);
  });

  it("uses the POI Commons category when the POI has no English Wikipedia page", async () => {
    const poi: PoiInput = {
      id: "basilica-costantiniana-di-s-agnese",
      name: "Basilica costantiniana di S. Agnese",
      city: "Rome",
      coordinates: { lat: 41.9231188, lng: 12.5173079 },
      sourceHints: {
        wikimediaCommons: "Category:Sant'Agnese fuori le mura (Rome) - Basilica costantiniana",
      },
    };
    server.use(
      http.get("https://commons.wikimedia.org/w/api.php", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("list") === "categorymembers") {
          expect(url.searchParams.get("cmtitle")).toBe(poi.sourceHints.wikimediaCommons);
          return HttpResponse.json({
            query: { categorymembers: [{ title: "File:Constantinian basilica.jpg" }] },
          });
        }
        if (url.searchParams.get("prop") === "imageinfo") {
          return HttpResponse.json({
            query: {
              pages: [
                {
                  imageinfo: [
                    {
                      url: "https://upload.wikimedia.org/original.jpg",
                      thumburl: "https://upload.wikimedia.org/thumb.jpg",
                      extmetadata: {
                        LicenseShortName: { value: "CC BY-SA 4.0" },
                        Artist: { value: "Example photographer" },
                      },
                    },
                  ],
                },
              ],
            },
          });
        }
        return new HttpResponse(null, { status: 400 });
      }),
    );

    await expect(fetchMainImageCandidates(poi, "Mausoleum of Constantina")).resolves.toMatchObject([
      {
        commonsFileName: "Constantinian_basilica.jpg",
        discoveredVia: "commons-category",
        isProposed: true,
      },
    ]);
  });
});
