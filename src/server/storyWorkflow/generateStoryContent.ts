import type { PoiInput } from "@/server/wikiPipeline/types";
import { parseStoryContent, storyContentJsonSchema, type StoryContent } from "./storyContent";
import type { Source } from "./types";

type AiGenerationConfig = {
  provider: "ollama" | "gemini";
  model: string;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const systemPrompt = `Create concise, source-grounded Story Content for a cultural Point of Interest.
Return only data matching the provided JSON schema.

The introduction must identify what the Point of Interest is and why it matters.
Use only the optional Story Topics history, design, and art. Omit unsupported topics by returning an empty array. Each Visitor Insight must contain one useful, independent idea rather than a complete article summary.

Use plain contemporary English. Do not use Markdown, HTML, JSX, headings, bullets, promotional language, poetic narration, or invented facts. Use only Source IDs supplied in the input. Define each Related Person once and link that person only to Visitor Insights where the relationship is relevant. Do not include an unlinked Related Person.

For History, include structured time only when the Source supports it. Use negative years for BC/BCE, positive years for AD/CE, and never use year zero. Preserve approximate dates and century granularity. Order dated History Insights from oldest to newest and place undated History Insights after them.`;

const getOllamaBaseUrl = () => process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

const getGeminiApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required when using Gemini.");
  }
  return apiKey;
};

const toPrompt = (pointOfInterest: PoiInput, sources: Source[]) =>
  JSON.stringify(
    {
      pointOfInterest: {
        id: pointOfInterest.id,
        name: pointOfInterest.name,
        city: pointOfInterest.city,
      },
      sources,
    },
    null,
    2,
  );

const parseGeneratedContent = (content: string, sources: Source[]) =>
  parseStoryContent(
    JSON.parse(content),
    sources.map((source) => source.id),
  );

const generateWithGemini = async (pointOfInterest: PoiInput, sources: Source[], model: string) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${getGeminiApiKey()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: toPrompt(pointOfInterest, sources) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: storyContentJsonSchema,
        },
      }),
    },
  );
  const data = (await response.json()) as GeminiGenerateContentResponse;
  if (!response.ok) {
    throw new Error(
      `Gemini failed: HTTP ${response.status}${
        data.error?.message ? ` - ${data.error.message}` : ""
      }`,
    );
  }
  const content =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";
  if (!content) {
    throw new Error("Gemini returned empty Story Content.");
  }
  return parseGeneratedContent(content, sources);
};

const generateWithOllama = async (pointOfInterest: PoiInput, sources: Source[], model: string) => {
  const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: storyContentJsonSchema,
      options: { temperature: 0.2 },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: toPrompt(pointOfInterest, sources) },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Ollama failed: HTTP ${response.status}`);
  }
  const data = (await response.json()) as OllamaChatResponse;
  const content = data.message?.content?.trim() ?? "";
  if (!content) {
    throw new Error("Ollama returned empty Story Content.");
  }
  return parseGeneratedContent(content, sources);
};

export const generateStoryContent = async (
  pointOfInterest: PoiInput,
  sources: Source[],
  config: AiGenerationConfig,
): Promise<StoryContent> => {
  const startedAt = Date.now();
  console.info(`[story-content] Starting ${config.provider} generation with ${config.model}.`);
  const storyContent =
    config.provider === "gemini"
      ? await generateWithGemini(pointOfInterest, sources, config.model)
      : await generateWithOllama(pointOfInterest, sources, config.model);
  console.info(
    `[story-content] Completed ${config.provider} generation in ${Math.round((Date.now() - startedAt) / 1000)}s.`,
  );
  return storyContent;
};
