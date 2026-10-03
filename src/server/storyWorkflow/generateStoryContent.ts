import { jsonrepair } from "jsonrepair";
import { logAiResponseFailure, readAiResponse } from "@/server/aiResponseLog";
import type { PoiInput } from "@/server/wikiPipeline/types";
import { parseStoryContent, storyContentJsonSchema, type StoryContent } from "./storyContent";
import type { Source } from "./types";

type AiGenerationConfig = {
  mode: "local" | "cloud";
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

const systemPrompt = `Create concise, source-grounded Story Content for a cultural POI.
Return only data matching the provided JSON schema.
The top-level object must contain exactly introduction, topics, and relatedPeople. introduction must contain text and sourceIds. topics must contain history, design, and art arrays. Every topic item must contain id, description, and sourceIds; only history items may additionally contain time. A time value must always be an object, never a number or string: use {"startYear": 312, "precision": "exact", "granularity": "year"} for a year, or include endYear and use granularity "century" for a century range. Every relatedPeople item must contain only name and sourceIds. Use sourceIds as arrays of supplied Source ID strings. Never return source, history, design, art, visitorInsights, or people as top-level fields.

The introduction must identify what the POI is and why it matters.
Use only the optional Story Topics history, design, and art. Omit unsupported topics by returning an empty array. Each Visitor Insight must contain one useful, independent idea rather than a complete article summary.

Use plain contemporary English. Do not use Markdown, HTML, JSX, headings, bullets, promotional language, poetic narration, or invented facts. Use only Source IDs supplied in the input. Include each person only once. For each Related Person, use the exact Wikipedia link title supplied in Source links as the name, rather than adding honorifics or inventing a different spelling; omit people mentioned only in the prose without a personal Wikipedia link. Select at most ten people who are most significant to understanding the POI, ordered from most to least significant. A person may be historical, mythological, or imaginary. Return only each person's name and supporting Source IDs; do not describe or classify the relationship.

For History, include structured time only when the Source supports it. Use negative years for BC/BCE, positive years for AD/CE, and never use year zero. Preserve approximate dates and century granularity. Order dated History Insights from oldest to newest and place undated History Insights after them.`;

const cloudOllamaSystemPrompt = `${systemPrompt}

JSON schema:
${JSON.stringify(storyContentJsonSchema)}`;

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
      sources: sources.map(({ id, kind, title, url, content, links }) => ({
        id,
        kind,
        title,
        url,
        content,
        links: links ?? [],
      })),
    },
    null,
    2,
  );

const parseGeneratedContent = (content: string, sources: Source[]) => {
  let storyContent: StoryContent;
  try {
    storyContent = parseStoryContent(
      JSON.parse(content),
      sources.map(({ id }) => id),
    );
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    try {
      // Some models prefix topic objects with an extra quote: ,"{"id":...
      storyContent = parseStoryContent(
        JSON.parse(jsonrepair(content.replace(/,\s*"(?=\{\s*"id"\s*:)/g, ","))),
        sources.map(({ id }) => id),
      );
    } catch {
      throw error;
    }
    console.warn("[story-content] Recovered malformed JSON and validated the Story schema.");
  }
  return {
    ...storyContent,
    relatedPeople: storyContent.relatedPeople.map(({ name, sourceIds }) => ({ name, sourceIds })),
  };
};

const generateWithGemini = async (
  pointOfInterest: PoiInput,
  sources: Source[],
  model: string,
  mode: AiGenerationConfig["mode"],
) => {
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
  const context = {
    kind: "storyContent" as const,
    subjectId: pointOfInterest.id,
    subjectName: pointOfInterest.name,
    mode,
    provider: "gemini" as const,
    model,
    attempt: 1,
  };
  const { data, rawResponse } = await readAiResponse<GeminiGenerateContentResponse>(
    response,
    context,
  );
  try {
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
  } catch (error) {
    logAiResponseFailure(context, rawResponse, error);
    throw error;
  }
};

const generateWithOllama = async (
  pointOfInterest: PoiInput,
  sources: Source[],
  model: string,
  mode: AiGenerationConfig["mode"],
) => {
  const messages = [
    { role: "system", content: mode === "cloud" ? cloudOllamaSystemPrompt : systemPrompt },
    { role: "user", content: toPrompt(pointOfInterest, sources) },
  ];
  const attempts = mode === "cloud" ? 2 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        ...(mode === "local" ? { format: storyContentJsonSchema } : {}),
        options: { temperature: 0.2 },
        messages,
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama failed: HTTP ${response.status}`);
    }
    const context = {
      kind: "storyContent" as const,
      subjectId: pointOfInterest.id,
      subjectName: pointOfInterest.name,
      mode,
      provider: "ollama" as const,
      model,
      attempt: attempt + 1,
    };
    const { data, rawResponse } = await readAiResponse<OllamaChatResponse>(response, context);
    const content = data.message?.content?.trim() ?? "";
    if (!content) {
      const error = new Error("Ollama returned empty Story Content.");
      logAiResponseFailure(context, rawResponse, error);
      throw error;
    }

    try {
      return parseGeneratedContent(content, sources);
    } catch (error) {
      logAiResponseFailure(context, rawResponse, error);
      if (attempt === attempts - 1) throw error;
      messages.push(
        { role: "assistant", content },
        {
          role: "user",
          content: `The previous response was invalid: ${
            error instanceof Error ? error.message : "Unknown validation error"
          }. Return corrected JSON only, matching the provided schema.`,
        },
      );
    }
  }

  throw new Error("Ollama failed to generate Story Content.");
};

export const generateStoryContent = async (
  pointOfInterest: PoiInput,
  sources: Source[],
  config: AiGenerationConfig,
): Promise<StoryContent> => {
  const startedAt = Date.now();
  console.info(`[story-content] Starting ${config.provider} generation with ${config.model}.`);
  let storyContent: StoryContent;
  try {
    storyContent =
      config.provider === "gemini"
        ? await generateWithGemini(pointOfInterest, sources, config.model, config.mode)
        : await generateWithOllama(pointOfInterest, sources, config.model, config.mode);
  } catch (error) {
    console.error(`[story-content] ${config.provider} generation failed.`, error);
    throw error;
  }
  console.info(
    `[story-content] Received ${config.provider} Story Content in ${Math.round((Date.now() - startedAt) / 1000)}s.`,
  );
  return storyContent;
};
