import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { linkWikidata } from "./linkWikidata";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Wikidata identity linking", () => {
  it.each([
    ["Q127883866", "Q124218142"],
    ["Q97180948", "Q65174339"],
  ])("recognizes the redirect from %s to %s", async (previousId, canonicalId) => {
    server.use(
      http.get("https://www.wikidata.org/w/api.php", ({ request }) => {
        expect(new URL(request.url).searchParams.get("ids")).toBe(`${previousId}|${canonicalId}`);
        return HttpResponse.json({
          entities: {
            [previousId]: { id: canonicalId, redirects: { from: previousId, to: canonicalId } },
            [canonicalId]: { id: canonicalId },
          },
        });
      }),
    );
    const catalog = { features: [{ id: "poi", wikidataId: previousId }] };
    await expect(linkWikidata(catalog, "poi", canonicalId)).resolves.toEqual({
      features: [{ id: "poi", wikidataId: canonicalId }],
    });
    expect(catalog.features[0].wikidataId).toBe(previousId);
  });

  it.each(["different entities", "missing entities"])("rejects %s", async (scenario) => {
    server.use(
      http.get("https://www.wikidata.org/w/api.php", () =>
        HttpResponse.json({
          entities:
            scenario === "missing entities"
              ? {}
              : {
                  Q3939487: { id: "Q3939487" },
                  Q54863376: { id: "Q54863376" },
                },
        }),
      ),
    );
    const catalog = { features: [{ id: "castle", wikidataId: "Q3939487" }] };
    await expect(linkWikidata(catalog, "castle", "Q54863376")).rejects.toThrow();
    expect(catalog.features[0].wikidataId).toBe("Q3939487");
  });
});
