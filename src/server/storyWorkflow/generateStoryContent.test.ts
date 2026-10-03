import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
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

const originalDirectory = process.cwd();
let temporaryDirectory: string;
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  temporaryDirectory = mkdtempSync(path.join(tmpdir(), "ai-response-tests-"));
  process.chdir(temporaryDirectory);
});
afterEach(() => {
  process.chdir(originalDirectory);
  rmSync(temporaryDirectory, { recursive: true, force: true });
  server.resetHandlers();
});
afterAll(() => server.close());

describe("Story Content AI adapters", () => {
  it("recovers the recorded Acqua Vergine response without changing its insights", async () => {
    const response = JSON.parse(
      readFileSync(
        path.join(
          originalDirectory,
          "src/server/storyWorkflow/fixtures/acqua-vergine-malformed.json",
        ),
        "utf-8",
      ),
    );
    let requests = 0;
    server.use(
      http.post("http://localhost:11434/api/chat", () => {
        requests += 1;
        return HttpResponse.json(response);
      }),
    );
    const result = await generateStoryContent(pointOfInterest, sources, {
      mode: "cloud",
      provider: "ollama",
      model: "gpt-oss:20b-cloud",
    });
    expect(result.topics.history).toHaveLength(6);
    expect(result.topics.history[1]).toMatchObject({
      id: "repair-tiberius",
      description: "Repaired by Emperor Tiberius in 37 AD.",
      sourceIds: ["wikipedia"],
      time: { startYear: 37 },
    });
    expect(result.relatedPeople).toHaveLength(10);
    expect(requests).toBe(1);
  });

  it("discards Person IDs supplied by AI so names must pass real identity resolution", async () => {
    server.use(
      http.post("http://localhost:11434/api/chat", () =>
        HttpResponse.json({
          message: {
            content: JSON.stringify({
              ...generated,
              relatedPeople: [{ name: "Hercules", personId: "Hercules", sourceIds: ["wikipedia"] }],
            }),
          },
        }),
      ),
    );
    const result = await generateStoryContent(pointOfInterest, sources, {
      mode: "local",
      provider: "ollama",
      model: "test-model",
    });
    expect(result.relatedPeople).toEqual([{ name: "Hercules", sourceIds: ["wikipedia"] }]);
  });
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
        mode: "cloud",
        provider: "gemini",
        model: "test-model",
      }),
    ).resolves.toEqual(generated);
    expect(requestedSchema).toMatchObject({ type: "object" });
    const historyTimeSchema = (
      requestedSchema as {
        properties: {
          topics: {
            properties: {
              history: {
                items: {
                  properties: {
                    time: {
                      oneOf: Array<{
                        properties: { granularity: { const: string } };
                        required: string[];
                      }>;
                    };
                  };
                };
              };
            };
          };
        };
      }
    ).properties.topics.properties.history.items.properties.time;
    expect(
      historyTimeSchema.oneOf.find(({ properties }) => properties.granularity.const === "century")
        ?.required,
    ).toContain("endYear");
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
        mode: "local",
        provider: "ollama",
        model: "test-model",
      }),
    ).resolves.toEqual(generated);
    expect(requestedFormat).toMatchObject({ type: "object" });
    expect(existsSync(path.join("data", "generated", "ai-response-failures"))).toBe(false);
  });

  it("prompts Ollama Cloud with the schema and retries invalid output", async () => {
    const requests: Array<{
      format?: unknown;
      messages: Array<{ role: string; content: string }>;
    }> = [];
    server.use(
      http.post("http://localhost:11434/api/chat", async ({ request }) => {
        const body = (await request.json()) as (typeof requests)[number];
        requests.push(body);
        return HttpResponse.json({
          message: {
            content:
              requests.length === 1
                ? '  {"introduction": ["broken" "array"]}  '
                : JSON.stringify(generated),
          },
        });
      }),
    );

    await expect(
      generateStoryContent(pointOfInterest, sources, {
        mode: "cloud",
        provider: "ollama",
        model: "gpt-oss:20b-cloud",
      }),
    ).resolves.toEqual(generated);
    expect(requests).toHaveLength(2);
    const directory = path.join("data", "generated", "ai-response-failures");
    const files = readdirSync(directory);
    expect(files).toHaveLength(1);
    const failure = JSON.parse(readFileSync(path.join(directory, files[0]), "utf-8"));
    expect(failure).toMatchObject({
      kind: "storyContent",
      subjectId: pointOfInterest.id,
      provider: "ollama",
      model: "gpt-oss:20b-cloud",
      mode: "cloud",
      attempt: 1,
    });
    expect(JSON.parse(failure.rawResponse).message.content).toBe(
      '  {"introduction": ["broken" "array"]}  ',
    );
    expect(failure.error).toContain("JSON");
    expect(requests[0].format).toBeUndefined();
    expect(requests[0].messages[0].content).toContain('"introduction"');
    expect(requests[1].messages).toContainEqual(
      expect.objectContaining({
        role: "user",
        content: expect.stringContaining("previous response was invalid"),
      }),
    );
  });

  it("captures an invalid HTTP JSON body without adding a retry", async () => {
    const rawResponse = '  {"message":';
    let requests = 0;
    server.use(
      http.post("http://localhost:11434/api/chat", () => {
        requests += 1;
        return new HttpResponse(rawResponse);
      }),
    );
    await expect(
      generateStoryContent(pointOfInterest, sources, {
        mode: "cloud",
        provider: "ollama",
        model: "test-model",
      }),
    ).rejects.toBeInstanceOf(SyntaxError);
    const directory = path.join("data", "generated", "ai-response-failures");
    const files = readdirSync(directory);
    expect(files).toHaveLength(1);
    expect(JSON.parse(readFileSync(path.join(directory, files[0]), "utf-8")).rawResponse).toBe(
      rawResponse,
    );
    expect(requests).toBe(1);
  });

  it("preserves both rejected attempts separately when cloud generation fails", async () => {
    server.use(
      http.post("http://localhost:11434/api/chat", () =>
        HttpResponse.json({ message: { content: "not JSON" } }),
      ),
    );
    await expect(
      generateStoryContent(pointOfInterest, sources, {
        mode: "cloud",
        provider: "ollama",
        model: "test-model",
      }),
    ).rejects.toBeInstanceOf(SyntaxError);
    const directory = path.join("data", "generated", "ai-response-failures");
    const failures = readdirSync(directory).map((file) =>
      JSON.parse(readFileSync(path.join(directory, file), "utf-8")),
    );
    expect(failures.map(({ attempt }) => attempt).sort()).toEqual([1, 2]);
  });

  it("preserves the original parsing error when diagnostic storage cannot be written", async () => {
    mkdirSync(path.join("data", "generated"), { recursive: true });
    writeFileSync(path.join("data", "generated", "ai-response-failures"), "Blocked storage");
    server.use(
      http.post("http://localhost:11434/api/chat", () =>
        HttpResponse.json({ message: { content: "not JSON" } }),
      ),
    );
    await expect(
      generateStoryContent(pointOfInterest, sources, {
        mode: "local",
        provider: "ollama",
        model: "test-model",
      }),
    ).rejects.toBeInstanceOf(SyntaxError);
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
        mode: "local",
        provider: "ollama",
        model: "test-model",
      }),
    ).rejects.toThrow("unknown Source");
  });
});
