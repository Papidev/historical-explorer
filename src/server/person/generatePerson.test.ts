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
  it("reports the Ollama error when the configured model is missing", async () => {
    server.use(
      http.post("http://localhost:11434/api/chat", () =>
        HttpResponse.json({ error: "model 'qwen3:8b' not found" }, { status: 404 }),
      ),
    );

    await expect(
      generatePerson(
        { name: "Constantina", wikidataId: "Q261654" },
        [
          {
            id: "wikipedia",
            kind: "wikipedia",
            title: "Constantina",
            url: "https://en.wikipedia.org/wiki/Constantina",
            content: "Source content",
          },
        ],
        { mode: "local", provider: "ollama", model: "qwen3:8b" },
      ),
    ).rejects.toThrow("Ollama failed: HTTP 404 - model 'qwen3:8b' not found");
  });
  it("uses the selected Ollama model and validates structured content", async () => {
    let requestedModel: unknown;
    let requestedThink: unknown;
    server.use(
      http.post("http://localhost:11434/api/chat", async ({ request }) => {
        const body = (await request.json()) as { model?: unknown; think?: unknown };
        requestedModel = body.model;
        requestedThink = body.think;
        return HttpResponse.json({ message: { content: JSON.stringify(generated) } });
      }),
    );

    await expect(
      generatePerson(
        { name: "Constantina", wikidataId: "Q261654" },
        [
          {
            id: "wikipedia",
            kind: "wikipedia",
            title: "Constantina",
            url: "https://en.wikipedia.org/wiki/Constantina",
            content: "Source content",
          },
        ],
        { mode: "local", provider: "ollama", model: "same-story-model" },
      ),
    ).resolves.toEqual(generated);
    expect(requestedModel).toBe("same-story-model");
    expect(requestedThink).toBe(false);
  });

  it("uses Ollama Cloud without schema enforcement and retries invalid JSON", async () => {
    const requests: Array<{
      format?: unknown;
      messages: Array<{ role: string; content: string }>;
      model: string;
    }> = [];
    server.use(
      http.post("http://localhost:11434/api/chat", async ({ request }) => {
        const body = (await request.json()) as (typeof requests)[number];
        requests.push(body);
        return HttpResponse.json({
          message: { content: requests.length === 1 ? "not JSON" : JSON.stringify(generated) },
        });
      }),
    );

    await expect(
      generatePerson(
        { name: "Hadrian", wikidataId: "Q1429" },
        [
          {
            id: "wikipedia",
            kind: "wikipedia",
            title: "Hadrian",
            url: "url",
            content: "Complete source text",
          },
        ],
        { mode: "cloud", provider: "ollama", model: "gpt-oss:20b-cloud" },
      ),
    ).resolves.toEqual(generated);

    expect(requests).toHaveLength(2);
    expect(requests[0].model).toBe("gpt-oss:20b-cloud");
    expect(requests[0].format).toBeUndefined();
    expect(requests[0].messages[0].content).toContain("JSON schema:");
    expect(requests[0].messages[1].content).toContain("Complete source text");
    expect(requests[1].messages.at(-1)?.content).toContain("previous response was invalid");
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
        { mode: "local", provider: "ollama", model: "model" },
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
        { mode: "local", provider: "ollama", model: "model" },
      ),
    ).resolves.toEqual({
      description: generated.description,
      curiosities: generated.curiosities,
    });
  });
});
