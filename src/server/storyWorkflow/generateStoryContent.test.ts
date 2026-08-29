import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { PoiInput } from "@/server/wikiPipeline/types";
import { generateStoryContent } from "./generateStoryContent";
import type { Source } from "./types";

const pointOfInterest: PoiInput = {
  id: "forum-boarium",
  name: "Forum Boarium",
  city: "Rome",
  coordinates: { lat: 41.889, lng: 12.481 },
  sourceHints: { wikidata: "Q152834" },
};

const sources: Source[] = [
  {
    id: "wikipedia",
    kind: "wikipedia",
    title: "Forum Boarium",
    url: "https://en.wikipedia.org/wiki/Forum_Boarium",
    content: "Forum Boarium was Rome's cattle market.",
  },
];

const generated = {
  introduction: {
    text: "Forum Boarium was Rome's ancient cattle market.",
    sourceIds: ["wikipedia"],
  },
  topics: { history: [], design: [], art: [] },
  relatedPeople: [],
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Story Content AI adapters", () => {
  it("requests and validates Gemini structured output", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    let requestedSchema: unknown;
    server.use(
      http.post(
        "https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent",
        async ({ request }) => {
          const body = (await request.json()) as {
            generationConfig?: { responseJsonSchema?: unknown };
          };
          requestedSchema = body.generationConfig?.responseJsonSchema;
          return HttpResponse.json({
            candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }],
          });
        },
      ),
    );

    await expect(
      generateStoryContent(pointOfInterest, sources, {
        provider: "gemini",
        model: "test-model",
      }),
    ).resolves.toEqual(generated);
    expect(requestedSchema).toMatchObject({ type: "object" });
  });

  it("requests and validates Ollama structured output", async () => {
    let requestedFormat: unknown;
    server.use(
      http.post("http://localhost:11434/api/chat", async ({ request }) => {
        const body = (await request.json()) as { format?: unknown };
        requestedFormat = body.format;
        return HttpResponse.json({ message: { content: JSON.stringify(generated) } });
      }),
    );

    await expect(
      generateStoryContent(pointOfInterest, sources, {
        provider: "ollama",
        model: "test-model",
      }),
    ).resolves.toEqual(generated);
    expect(requestedFormat).toMatchObject({ type: "object" });
  });

  it("rejects structured output with unknown Source References", async () => {
    server.use(
      http.post("http://localhost:11434/api/chat", () =>
        HttpResponse.json({
          message: {
            content: JSON.stringify({
              ...generated,
              introduction: { ...generated.introduction, sourceIds: ["unknown"] },
            }),
          },
        }),
      ),
    );

    await expect(
      generateStoryContent(pointOfInterest, sources, {
        provider: "ollama",
        model: "test-model",
      }),
    ).rejects.toThrow("unknown Source");
  });
});
