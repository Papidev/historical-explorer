import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fetchWikiSnapshot } from "./fetchWiki";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Wikipedia source acquisition", () => {
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
