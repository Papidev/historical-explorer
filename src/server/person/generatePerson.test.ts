import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { generatePerson } from "./generatePerson";

const server = setupServer();
const generated = {
  description: [
    { text: "First substantial paragraph.", sourceIds: ["wikipedia"] },
    { text: "Second substantial paragraph.", sourceIds: ["wikipedia"] },
  ],
  curiosities: [{ text: "A supported curiosity.", sourceIds: ["wikipedia"] }],
  birthDate: { year: 307, precision: "approximate" },
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Person generation", () => {
  it("uses the selected Ollama model and validates structured content", async () => {
    let requestedModel: unknown;
    server.use(
      http.post("http://localhost:11434/api/chat", async ({ request }) => {
        requestedModel = ((await request.json()) as { model?: unknown }).model;
        return HttpResponse.json({ message: { content: JSON.stringify(generated) } });
      }),
    );

    await expect(
      generatePerson(
        { name: "Constantina", wikidataId: "Q261654" },
        [{
          id: "wikipedia",
          kind: "wikipedia",
          title: "Constantina",
          url: "https://en.wikipedia.org/wiki/Constantina",
          content: "Source content",
        }],
        { provider: "ollama", model: "same-story-model" },
      ),
    ).resolves.toEqual(generated);
    expect(requestedModel).toBe("same-story-model");
  });

  it("rejects invented Source IDs", async () => {
    server.use(
      http.post("http://localhost:11434/api/chat", () =>
        HttpResponse.json({
          message: {
            content: JSON.stringify({
              ...generated,
              curiosities: [{ text: "Unsupported", sourceIds: ["invented"] }],
            }),
          },
        }),
      ),
    );

    await expect(
      generatePerson(
        { name: "Constantina", wikidataId: "Q261654" },
        [{ id: "wikipedia", kind: "wikipedia", title: "Constantina", url: "url", content: "text" }],
        { provider: "ollama", model: "model" },
      ),
    ).rejects.toThrow("unknown Source");
  });

  it("omits optional dates when the model returns an unsupported precision", async () => {
    server.use(
      http.post("http://localhost:11434/api/chat", () =>
        HttpResponse.json({
          message: {
            content: JSON.stringify({
              ...generated,
              birthDate: { year: 307, precision: "year" },
              deathDate: { year: 354, precision: "known" },
            }),
          },
        }),
      ),
    );

    await expect(
      generatePerson(
        { name: "Constantina", wikidataId: "Q261654" },
        [{ id: "wikipedia", kind: "wikipedia", title: "Constantina", url: "url", content: "text" }],
        { provider: "ollama", model: "model" },
      ),
    ).resolves.toEqual({
      description: generated.description,
      curiosities: generated.curiosities,
    });
  });
});
